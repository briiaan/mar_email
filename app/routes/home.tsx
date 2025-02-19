import "../styles/home.scss";
import { Form, redirect, data } from "react-router"
import type { Route } from "./+types/home";
import mongoose, { mongo } from 'mongoose';
import dotenv from "dotenv"
import { getSession, commitSession } from "~/sessions.server";
import {Account} from "../db/models";

const MONGODB_URI = process.env.MONGODB_URI;

export function meta() {
  return [
    { title: "Mar Email" },
    { name: "description", content: "World Class Email Client." },
  ];
}

export async function loader({
  request,
}: Route.LoaderArgs) {
  const session = await getSession(
    request.headers.get("Cookie")
  );
  if (session.has("userId")) {
    return redirect("/dashboard");
  }

  return data(
    { error: session.get("error") },
    {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}

export async function action({
  request,
}: Route.ActionArgs) {
  const session = await getSession(
    request.headers.get("Cookie")
  );
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  if(!email && !password) return { message: "Missing email and password"};
  if(!email) return { message: "Missing email"};
  if(!password) return { message: "Missing password"};
  try {
    await mongoose.connect(`${MONGODB_URI}/email`)
  } catch (err) {
    console.log(err)
  }
  const account = await Account.findOne({ email: email })
  if (account?.password == password || account == null) {
    console.log("verified");
    if(typeof email == "string") {
      session.set("userId", email);
      return redirect("/dashboard", {
        headers: {
          "Set-Cookie": await commitSession(session),
        }
      })
    } else {
      console.error("Email is not a string")
    }
  } else {
    console.log("password is incorrect")
    session.flash("error", "Invalid email/password");
    return redirect("/", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  }
}

export default function Home() {

  return <> 
  <div id="background">
    <div id="container-grid">
      <div id="container-grid-inner">
        <div id="login-box-container">
          <div id="logo">
            <p id="logo-text-a">mar</p>
            <p id="logo-text-b">email</p>
          </div>
          <div id="form-container">
          <Form method="post">
            <input id="email" placeholder="Email" name="email" type="email" required/>
            <input id="password" placeholder="Password" name="password" type="password" required/>
            <button id="submit" type="submit">Sign In</button>
          </Form>
          </div>
        </div>
      </div>
    </div>
    </div>
    </>;
}
