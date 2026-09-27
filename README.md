# Magic link authentication

## Introduction

This README is out of date, but might still contain some useful info.

This project includes a [Node.js](https://nodejs.org/en/about/) server script and a web page that connects to it. The front-end page presents a form that the visitor can use to get a magic link sent to their email address. The auto-sending of the email that contains the magic link is achieved using a package called [Nodemailer](https://www.npmjs.com/package/nodemailer).

Returning to the site via this magic link enables the user to choose a background colour for the page, which is saved in user_sessions.json alongside their email address. In this way, this project is a minimal example of a progressive web app (PWA) that supports user authentication, and enables saving user-specific data (in the form of a preferred background colour).

I don't particularly enjoy the [Handlebars](https://handlebarsjs.com/) templating framework used for src -> pages -> index.hbs, but I've left it in from the "glitch-hello-node" template code.

## Important

If you have hundreds or thousands of users, storing user-related data in a "flat JSON file" like described below is not ideal. You should use a database instead, but the approach below avoids you learning an extra (database) language such as [SQLite](https://glitch.com/edit/#!/remix/glitch-hello-sqlite).

Because this PWA involves storing users' email addresses, you should not leave user_sessions.json at the top level of the folder/file hierarchy. When you are happy your version of this project is working OK, you should move user_sessions.json to the hidden .data folder available with each Glitch project. This means people who navigate to your project code won't be able to see all your users' email addresses (and associated data), and the contents of .data will get scrubbed (removed) if anyone remixes (makes an independent copy of) your project.

To move user_sessions.json, open up the Terminal below, write
```
mv user_sessions.json .data/
```
and hit return. You will also need to find-replace "./user_sessions.json" in server.js with "./.data/user_sessions.json".

## Setting up Nodemailer

When you remix [save-bgcol](https://glitch.com/edit/#!/remix/save-bgcol), the trickiest thing is to set up Nodemailer. Lines 18-24 of server.js show how to do this with a Gmail account, but you do need to configure your Gmail account's security settings to enable the auto-sending of emails with Nodemailer, and you need to make sure you have an .env file and it contains the correct variable-value pairs.

### Creating the .env file

An .env file is also something that gets scrubbed on remix, so you need to make one by opening up the Terminal window below and executing
```
touch .env
```
You should see an .env file appear in the folder/file hierarchy on the left side of the screen.

### Populating the .env file

Click on it and you'll see a plaintext or graphical view of the file's contents. You need to add variables and values as follows,
```
SMTP_LOGIN=someone@some.where
SMTP_PASSW=wouldntyouliketoknow
TEST_SENDER=email.appears.to.be.from@this.address
```
replacing the boilerplate information with yours. Your values for `SMTP_LOGIN` and `TEST_SENDER` may well be the same. If you or your organisation uses Google Workspace and has issued you with an ugly-looking email address and a better-looking alias, then the ugly-looking email address would go in `SMTP_LOGIN` and the better-looking alias in `TEST_SENDER`. Otherwise, they can contain the same value.

### Your Gmail account setup

The value for `SMTP_PASSW` used to be the password you use for your Gmail account. **This is why it's important to put this information in the .env file.** Otherwise you might inadvertently publish your email password online! Anyone who you share this Glitch project with will be able to see the .env file's contents.

These days, with two-factor authentication all over the place, now it needs to be an app-device password, which you can set up as follows:

 1. For whatever Gmail account you want to use with Node mailer, go to [https://myaccount.google.com/](https://myaccount.google.com/) and select Security.

 2. Go down to "Signing into Google" and select App passwords.

 3. Select Mail from the app menu, Mac (or whatever device you're on) from the device menu, and it will produce and display a 16-character password.

 4. Clicking on the password should copy it to your clipboard.

 5. Paste it into the `SMTP_PASSW` value field of the .env file for your project.


## You're good

Your remix of this Glitch project (and Nodemailer) should now work.


## Prerequisites

You'll get best use out of this project if you're familiar with basic JavaScript. If you've written JavaScript for client-side web pages this is a little different because it uses server-side JS, but the syntax is the same!

## What's in this project?

← `README.md`: That’s this file, where you can tell people what your cool website does and how you built it.

← `public/style.css`: The styling rules for the pages in your site.

← `server.js`: The **Node.js** server script for your new site. The JavaScript defines the endpoints in the site back-end, one to return the homepage and one to update with the submitted color. Each one sends data to a Handlebars template which builds these parameter values into the web page the visitor sees.

← `package.json`: The NPM packages for your project's dependencies.

← `src/`: This folder holds the site template along with some basic data files.

← `src/pages/index.hbs`: This is the main page template for your site. The template receives parameters from the server script, which it includes in the page HTML. The page sends the user submitted color value in the body of a request, or as a query parameter to choose a random color.

← `src/colors.json`: A collection of CSS color names. We use this in the server script to pick a random color, and to match searches against color names.

← `src/seo.json`: When you're ready to share your new site or add a custom domain, change SEO/meta settings in here.

## Try this next 🏗️

Take a look in `TODO.md` for next steps you can try out in your new site!

___Want a minimal version of this project to build your own Node.js app? Check out [Blank Node](https://glitch.com/edit/#!/remix/glitch-blank-node)!___

![Glitch](https://cdn.glitch.com/a9975ea6-8949-4bab-addb-8a95021dc2da%2FLogo_Color.svg?v=1602781328576)

## You built this with Glitch!

[Glitch](https://glitch.com) is a friendly community where millions of people come together to build web apps and websites.

- Need more help? [Check out our Help Center](https://help.glitch.com/) for answers to any common questions.
- Ready to make it official? [Become a paid Glitch member](https://glitch.com/pricing) to boost your app with private sharing, more storage and memory, domains and more.
