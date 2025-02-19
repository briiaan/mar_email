import { createCookieSessionStorage } from "react-router";

type sessionData = {
    userId: string;
}

type sessionFlashData = {
    error: string;
}
    const { getSession, commitSession, destroySession } = createCookieSessionStorage<sessionData, sessionFlashData>
( 
    {
        cookie: {
            name: "__session",
            domain: "localhost",
            path: "/",
            sameSite: "lax",
            maxAge: 60,
            secrets: ["s3cret1"],
        }
    },
);

export {getSession, commitSession, destroySession}