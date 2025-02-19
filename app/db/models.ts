import mongoose from "mongoose";

const Account = mongoose.model('Account', new mongoose.Schema({
    email: String, password: String
}), 'account')

const Email = mongoose.model("Email", new mongoose.Schema({
    from: String,
    to: String,
    subject: String,
    body: String,
    flag: Boolean,
    is_trash: Boolean,
    time_sent: Date,
}))

export {Account, Email};