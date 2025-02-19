import type { Route } from "./+types/dashboard";
import "../styles/dashboard.scss"
import { getSession } from "~/sessions.server";
import data_emails from "../test/emails.json"
import data_account from "../test/accounts.json"
import { redirect, useLoaderData, Form, useSubmit } from "react-router";
import { useState } from "react"; // Import useState
import mongoose from "mongoose";
import dotenv from "dotenv"
import {Email} from "../db/models";

const MONGODB_URI = process.env.MONGODB_URI;


export function meta() {
  return [
    { title: "Dashboard" },
    { name: "description", content: "World Class Email Client." },
  ];
}

// /dashboard Action
export async function action({ request }: Route.ActionArgs) {
  try {
    const formData = await request.formData();

    const type = formData.get("type");
    const value = formData.get("value");
    const flag = formData.get("flag")
    const is_trash = formData.get("is_trash")
    const emailQuery = {
      from: formData.get("from"),
      subject: formData.get("subject"),
      body: formData.get("body"),
    };
 
    // Handle spam marking
    const updateData = {};
    if(type == "is_spam") {
      updateData.flag = value;
      const updatedEmail = await Email.findOneAndUpdate(emailQuery, updateData, {
        new: true, // Return the updated document
      });
      if (typeof updatedEmail == null) {
        return { success: false, message: "Email not found" };
      }
      return { success: true, updatedEmail };
      } else if (type == "is_trash") {
        console.log(value, type, is_trash)
        updateData.is_trash = value     
       // update email in db.
       const updatedEmail = await Email.findOneAndUpdate(emailQuery, updateData, {
         new: true, // Return the updated document
       });
       if (typeof updatedEmail == null) {
         return { success: false, message: "Email not found" };
       }
       return { success: true, updatedEmail };
 
    } else if (type == "new_message") {
      const to = formData.get("to");
      const subject = formData.get("subject");
      const body = formData.get("body")
      const from = formData.get("from")
      const email = {
        from: from,
        to: to,
        subject: subject,
        body: body,
        is_trash: false,
        time_sent: new Date(),
      }
      const postData = {
        body: body, // Send the body in the request
      };
    
      try {
        // Send the POST request to your backend
        const response = await fetch('http://127.0.0.1:8080/predict', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json', // Ensure JSON content type
          },
          body: JSON.stringify(postData), // Send the data as a JSON string
        });
    
        // Parse the response JSON
        const data = await response.json();
        email.flag = data.spam == 1 ? true : false
        console.log(email)
        const newEmail = new Email(email);
        await newEmail.save(); // Save to the database
        if (data.spam == 1) {
          console.log("Email detected as spam will be hidden from user upon receipt.")
        }

        } catch(err) {
          console.log(err)
        }
      }
    } catch (err) {
      console.log(err)
    }
}


export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  if (!session.get("userId")) {
    return redirect("/");
  }

  const current_user = session.get("userId");

  try {
    // Connect to MongoDB
    await mongoose.connect(`${MONGODB_URI}/email`);    
    const db = mongoose.connection;
    const emailsCollection = db.collection("emails");
    const accountsCollection = db.collection("account");

    // Fetch emails and accounts as arrays
    const data = await emailsCollection.find().toArray(); 
    const accounts = await accountsCollection.find().toArray();
    const user = accounts.find(user => user.email === current_user);
    // Filter, sort, and map emails    
    const filteredAndSortedEmails = data
      .filter(email => email.to === current_user) // Filter emails sent to user
      .sort((a, b) => new Date(b.time_sent).getTime() - new Date(a.time_sent).getTime()) // Sort recent first
      .map(email => {
        // Find sender profile in accounts collection
        const senderProfile = accounts.find(account => account.email === email.from);
        console.log(senderProfile)
        return {
          ...email,
          firstname: senderProfile?.firstname || "Unknown",
          lastname: senderProfile?.lastname || "Unknown",
          profilepic: senderProfile?.profilepic || "https://source.unsplash.com/200x200/?random",
          currentUserID: user?.first_name
        };
      });
    return filteredAndSortedEmails;
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
    return [];
  }
}

export async function clientLoader({
  serverLoader,
}: Route.ClientLoaderArgs) {
  const serverData = await serverLoader();
  console.log(serverData)
  return serverData
}

export default function Dashboard() {
  const emails = useLoaderData();
  const submit = useSubmit();
  const [currentEmail, setCurrentEmail] = useState(null);
  const [isComposing, setIsComposing] = useState(false);
  const [newMessage, setNewMessage] = useState({ to: "", subject: "", body: "" });
  const [filter, setFilter] = useState("inbox"); // Default filter is inbox

  // Dragging State
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Filter emails based on selection
  const filteredEmails = emails.filter((email) => {
    if (filter === "inbox") return email.flag === false && !email.is_trash;
    if (filter === "spam") return email.flag === true && !email.is_trash;
    if (filter === "trash") return email.is_trash === true;
    return true;
  });

  // Open & Close Message Form
  const openMessageForm = () => {
    setNewMessage({ to: "", subject: "", body: "" });
    setIsComposing(true);
    setPosition({ x: 100, y: 100 });
  };
  const closeMessageForm = () => setIsComposing(false);

  // Drag Handlers
  const startDrag = (e) => {
    setDragging(true);
    setOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  };
  const onDrag = (e) => {
    if (dragging) setPosition({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const stopDrag = () => setDragging(false);

  // Submit New Message
  const sendMessage = (e) => {
    e.preventDefault();
    submit({...newMessage, type: "new_message", value: 0, from: emails[0].to}, { method: "post", action: "/dashboard" });
    closeMessageForm();
  };

  const markAsSpam = () => {
    if (!currentEmail) return;
  
    // Check the flag value of currentEmail and toggle is_spam value
    const updatedEmail = {
      ...currentEmail,
      type: "is_spam",
      value: currentEmail.flag === true ? false : true, // Set value to 0 if flag is 1, else set it to 1
    };
  
    submit(updatedEmail, { method: "post", action: "/dashboard" });
    setCurrentEmail(null); // Reset after marking as spam
  };

  // Move to Trash
  const moveToTrash = () => {
    if (!currentEmail) return;
  
    // Check the flag value of currentEmail and toggle is_spam value
    const updatedEmail = {
      ...currentEmail,
      type: "is_trash",
      value: currentEmail.is_trash === true ? false : true, // Set value to 0 if flag is 1, else set it to 1
    };
  
    submit(updatedEmail, { method: "post", action: "/dashboard" });
    setCurrentEmail(null); // Reset after marking as spam
  };

  return (
    <>
      <div id="background-dashboard" onMouseMove={onDrag} onMouseUp={stopDrag}>
        <div id="container-grid-dashboard">
          <div id="top-header">
            <div id="title">
              <div id="logo">
                <p id="logo-text">mar email</p>
                <div id="new-message-button" onClick={openMessageForm}>
                  <p>Create Message</p>
                </div>
              </div>
              <div id="greeting"><p>Hello, {emails[0].currentUserID}</p></div>
            </div>
          </div>

          <div id="body-dashboard">
            <div id="body-inner-dashboard">
              <div id="options">
                <div id="inbox-container" onClick={() => setFilter("inbox")}>
                  <a id="inbox-inner"><p>Inbox</p></a>
                </div>
                <div id="spam-container" onClick={() => setFilter("spam")}>
                  <a id="spam-inner"><p>Spam</p></a>
                </div>
                <div id="trash-container" onClick={() => setFilter("trash")}>
                  <a id="trash-inner"><p>Trash</p></a>
                </div>
              </div>

              <div id="email-list">
                <div id="email-list-container">
                  {filteredEmails.map((x, index) => (
                    <div id="email-item" key={index} onClick={() => setCurrentEmail(x)}>
                      <div id="email-name-list">
                        <p>{x.firstname} {x.lastname}</p>
                        <div id="email-body-list">
                          <p>{x.body.length > 45 ? x.body.slice(0, 45) + "..." : x.body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div id="email-contents">
                {isComposing ? (
                  <div
                    id="new-message-container"
                    style={{ left: `${position.x}px`, top: `${position.y}px` }}
                    onMouseDown={startDrag}
                  >
                    <div id="new-message-header">
                      <h2>New Message</h2>
                      <button onClick={closeMessageForm}>✖</button>
                    </div>
                    <Form method="post" action="/send-message" onSubmit={sendMessage}>
                      <input
                        type="email"
                        name="to"
                        placeholder="To"
                        value={newMessage.to}
                        onChange={(e) => setNewMessage({ ...newMessage, to: e.target.value })}
                        required
                      />
                      <input
                        type="text"
                        name="subject"
                        placeholder="Subject"
                        value={newMessage.subject}
                        onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                        required
                      />
                      <textarea
                        name="body"
                        placeholder="Message"
                        value={newMessage.body}
                        onChange={(e) => setNewMessage({ ...newMessage, body: e.target.value })}
                        required
                      />
                      <button type="submit">Send</button>
                      <button type="button" onClick={closeMessageForm}>Close</button>
                    </Form>
                  </div>
                ) : currentEmail != null ? (
                  <div id="contents-container">
                    <div id="header">
                      <div id="subject"><h2>{currentEmail.subject}</h2></div>
                      <div id="is-spam-button" onClick={markAsSpam}>
                        <p>This is spam</p>
                      </div>
                      <div id="move-to-trash-button" onClick={moveToTrash}>
                        <p>Move to Trash</p>
                      </div>
                    </div>
                    <div id="profile">
                      <div id="avi"><img src={currentEmail.profilepic} alt="Avatar" /></div>
                      <div id="contact">
                        <div id="name-info"><p>{currentEmail.firstname} {currentEmail.lastname}</p></div>
                        <div id="email-info"><p>{currentEmail.from}</p></div>
                      </div>
                    </div>
                    <div id="body-container-email">
                      <p>{currentEmail.body}</p>
                    </div>
                  </div>
                ) : (
                  <div className="center-container">
                    <div className="spinner"></div>
                    <div>Please click on an email</div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
