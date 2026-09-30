
/**
* This is the main Node.js server script for your project
*/

const path = require("path")
const fs = require("fs")
const { "v4": uuidv4 } = require("uuid")
const archiver = require("archiver")

// Require the fastify framework and instantiate it
const fastify = require("fastify")({
  // Set this to true for detailed logging:
  logger: false
})

const nodemailer = require("nodemailer")
// Create reusable transporter object using the default SMTP transport.
const transporter = nodemailer.createTransport({
  "service": "gmail",
  "auth": {
    "user": process.env.SMTP_LOGIN,
    "pass": process.env.SMTP_PASSW
  },
  "debug": true
})

// Setup our static files
fastify.register(require("fastify-static"), {
  root: path.join(__dirname, "public"),
  prefix: "/" // optional: default '/'
})

// Serve the browser builds locally so the game room does not depend on a CDN.
fastify.register(require("fastify-static"), {
  root: path.join(__dirname, "node_modules", "nexusui", "dist"),
  prefix: "/vendor/nexusui/",
  decorateReply: false
})
fastify.register(require("fastify-static"), {
  root: path.join(__dirname, "node_modules", "tone", "build"),
  prefix: "/vendor/tone/",
  decorateReply: false
})

// fastify-formbody lets us parse incoming forms
// fastify.register(require("fastify-formbody"));

// point-of-view is a templating manager for fastify
fastify.register(require("point-of-view"), {
  engine: {
    handlebars: require("handlebars")
  }
})

// Socket.IO lets a host and invitee join the same temporary invitation room.
// This follows the room-based collaboration pattern used in web-jam.
fastify.register(require("fastify-socket.io"))

const publicUrl = "https://save-bgcol-production.up.railway.app"
// Load and parse SEO data
const seo = require("./src/seo.json");
seo.url = publicUrl

let userSessions // Will read data into this variable.
const sessionLength = 30*60*1000 // Max 30 min session
const fnam = "./data/user_sessions.json"

const invitations = {}
const idToSocket = {}
const playerSessions = {}
const invitationLength = 24 * 60 * 60 * 1000 // Invitations last one day.

function isValidEmail(email){
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function invitationBaseUrl(req){
  // Use the deployed URL when configured, but make local development links work too.
  if (process.env.PUBLIC_URL){
    return process.env.PUBLIC_URL.replace(/\/$/, "")
  }
  if (req && req.headers && req.headers.host){
    const protocol = req.headers["x-forwarded-proto"] || "http"
    return protocol + "://" + req.headers.host
  }
  return publicUrl
}

function getPlayerIndex(invitation, playerToken){
  return invitation.playerTokens.indexOf(playerToken)
}

function gameState(invitation){
  return {
    melody: invitation.melody,
    turnIndex: invitation.turnIndex,
    bpm: 120
  }
}

function joinGameRoom(socket, payload){
  const invitationId = payload && payload.invitationId
  const playerToken = payload && payload.playerToken
  const invitation = invitations[invitationId]
  const playerIndex = invitation && getPlayerIndex(invitation, playerToken)

  if (!invitation || playerIndex === -1 || Date.now() - invitation.createdAt > invitationLength){
    socket.emit("invitation-error", "This game link is invalid or has expired.")
    return null
  }

  socket.join(invitationId)
  playerSessions[socket.id] = { invitationId: invitationId, playerIndex: playerIndex }
  socket.emit("game-state", Object.assign({ playerIndex: playerIndex }, gameState(invitation)))
  return { invitation: invitation, playerIndex: playerIndex }
}

fastify.ready(err => {
  if (err) throw err

  fastify.io.on("connection", socket => {
    idToSocket[socket.id] = socket

    socket.on("join-invitation", payload => {
      const joined = joinGameRoom(socket, payload)
      // The invitee (player 1) entering starts the shared game room transition.
      if (joined && joined.playerIndex === 1){
        fastify.io.to(payload.invitationId).emit("game-ready")
      }
    })

    // A page refresh restores membership without re-triggering navigation.
    socket.on("join-game-room", payload => {
      joinGameRoom(socket, payload)
    })

    socket.on("add-note", midi => {
      const player = playerSessions[socket.id]
      const invitation = player && invitations[player.invitationId]
      if (!invitation || !Number.isInteger(midi) || midi < 48 || midi > 72){
        socket.emit("game-error", "That note is not available on this piano.")
        return
      }
      if (player.playerIndex !== invitation.turnIndex){
        socket.emit("game-error", "Please wait for your turn.")
        return
      }

      invitation.melody.push(midi)
      invitation.turnIndex = (invitation.turnIndex + 1) % invitation.playerTokens.length
      fastify.io.to(player.invitationId).emit("game-state", gameState(invitation))
    })

    socket.on("disconnect", () => {
      delete idToSocket[socket.id]
      delete playerSessions[socket.id]
    })
  })
})

/**
* Our home page route
*
* Returns src/pages/index.hbs with data built into it
*/
fastify.get("/", function(req, rep){
  // params is an object we'll pass to our handlebars template
  let params = { seo: seo }
  // The Handlebars code will be able to access the parameter values and build them into the page
  rep.view("/src/pages/index.hbs", params)
})

fastify.get("/game-room", function(req, rep){
  rep.view("/src/pages/game-room.hbs")
})

//////////////////////
// Email invitations //
//////////////////////
fastify.post("/api/invitations", async function(req, rep){
  const body = req.body || {}
  const inviteeEmail = typeof body.inviteeEmail === "string" ? body.inviteeEmail.trim() : ""
  const hostSocket = idToSocket[body.socketId]

  if (!isValidEmail(inviteeEmail)){
    return rep.code(400).send({ msg: "Please enter a valid invitee email address." })
  }
  if (!hostSocket){
    return rep.code(409).send({ msg: "Your live connection is not ready. Please try again." })
  }

  const invitationId = uuidv4()
  const hostToken = uuidv4()
  const inviteeToken = uuidv4()
  const invitationUrl = invitationBaseUrl(req) + "?invite=" +
    encodeURIComponent(invitationId) + "&player=" + encodeURIComponent(inviteeToken)
  invitations[invitationId] = {
    createdAt: Date.now(),
    playerTokens: [hostToken, inviteeToken],
    melody: [],
    turnIndex: 0
  }
  hostSocket.join(invitationId)
  playerSessions[hostSocket.id] = { invitationId: invitationId, playerIndex: 0 }

  const message = [
    "You have been invited to collaborate.",
    "",
    "Open this link to join the game room:",
    invitationUrl,
    "",
    "This invitation expires in 24 hours."
  ].join("\n")

  try {
    await transporter.sendMail({
      from: '"Collaboration invite" <' + process.env.TEST_SENDER + ">",
      to: inviteeEmail,
      subject: "You're invited to collaborate",
      text: message,
      html: message.replace(/\n/g, "<br>")
    })
  }
  catch (err){
    delete invitations[invitationId]
    return rep.code(502).send({
      msg: "The invitation email could not be sent. Check the SMTP configuration and try again."
    })
  }

  return rep.send({
    msg: "Invitation email sent.",
    invitationUrl: invitationUrl,
    hostWaitingUrl: "/?invite=" + encodeURIComponent(invitationId) +
      "&player=" + encodeURIComponent(hostToken),
    invitationId: invitationId
  })
})


///////////////////////////
// Magic link generation //
///////////////////////////
fastify.post("/api/magicLink", function(req, rep){
  // Here's the IPv4 and 6, just to show where they live.
  if (req && req.headers && req.headers["x-forwarded-for"]){
    console.log(
      "req.headers['x-forwarded-for']:",
      req.headers['x-forwarded-for']
    )
  }
  // req.connection.remoteAddress is relevant too.
  const emailAddr = req.body.emailAddr
  if (emailAddr === null){
    rep.code(404).send()
    return
  }

  fs.readFile(
    fnam, "utf8",
    (err, str) => {
      if (err){
        throw err
      }
      else {
        userSessions = JSON.parse(str)
        console.log("userSessions:", userSessions)

        if (userSessions[emailAddr] === undefined){
          // New user
          const entry = {
            "magicLink": uuidv4(),
            "stampCreate": Date.now()
          }
          userSessions[emailAddr] = entry
          // Write updated userSessions to file.
          fs.writeFile(
            fnam,
            JSON.stringify(userSessions, null, 2),
            {
              "encoding": "utf8",
              // "flag": "w"
            },
            (err) => {
              if (err){
                throw err
              }
              else {
                console.log("About to send email!")
                const msgText = 'Hello and welcome!<br><br>Please click the link below to access the save-bgcol app. Check this email is from ' + process.env.TEST_SENDER + ' to avoid following a malicious link.<br><br>' + publicUrl + '?mlk=' + userSessions[emailAddr]["magicLink"] + '<br><br>Best wishes,<br>Tom Collins'
                const mailOptions = {
                  from: '"' + "Someone" + '" <' +
                  process.env.TEST_SENDER + '>',
                  to: emailAddr,
                  subject: "Magic link for save-bgcol",
                  text: msgText,
                  html: msgText
                }

                // Send mail with defined transport object.
                transporter.sendMail(
                  mailOptions, function(error, info){
                    if (error){
                      return console.log(error)
                    }
                    console.log("info.response:", info.response)

                    rep.send({
                      "msg": "Email with link sent to new user."
                    })
                  }
                )
              }
            }
          )
        }
        else {
          // Existing user
          userSessions[emailAddr]["magicLink"] = uuidv4()
          userSessions[emailAddr]["stampCreate"] = Date.now()
          // Write updated userSessions to file.
          fs.writeFile(
            fnam,
            JSON.stringify(userSessions, null, 2),
            {
              "encoding": "utf8",
              // "flag": "w"
            },
            (err) => {
              if (err){
                throw err
              }
              else {
                console.log("About to send email!")
                const msgText = 'Hello!<br><br>Please click the link below to access the save-bgcol app. Check this email is from ' + process.env.TEST_SENDER + ' to avoid following a malicious link.<br><br>' + publicUrl + '?mlk=' + userSessions[emailAddr]["magicLink"] + '<br><br>Best wishes,<br>T. Collins'
                const mailOptions = {
                  from: '"' + "Someone" + '" <'
                  + process.env.TEST_SENDER + '>',
                  to: emailAddr,
                  subject: "Magic link for save-bgcol",
                  text: msgText,
                  html: msgText
                }

                // Send mail with defined transport object.
                transporter.sendMail(mailOptions, function(error, info){
                  if (error){ return console.log(error) }
                  console.log("info.response:", info.response)

                  rep.send({
                    "msg": "Link generated and email sent to existing user."
                  })
                })
              }
            }
          )
        }
      }
    }
  )
})


////////////////////
// Authentication //
////////////////////
fastify.post("/api/auth", function(req, rep){
  console.log("req.body:", req.body)
  const magicLink = req.body.magicLink
  if (magicLink === null){
    rep.code(404).send()
    return
  }

  fs.readFile(
    fnam, "utf8",
    (err, str) => {
      if (err){
        throw err
      }
      else {
        userSessions = JSON.parse(str)
        console.log("userSessions:", userSessions)
        // Find email address associated with the magic link.
        const eAddr = Object.keys(userSessions).find(function(e){
          return userSessions[e].magicLink === magicLink
        })
        console.log("eAddr:", eAddr)

        // Server reply depends on finding associated email address.
        if (eAddr === undefined){
          rep.send({ "msg": "Invalid magic link" })
        }
        else if (
          Date.now() - userSessions[eAddr]["stampCreate"]
          > sessionLength
        ){
          rep.send({ "msg": "Session expired." })
        }
        else {
          rep.send({
            "msg": "Authentication successful!",
            "authToken": magicLink,
            "bgcol": userSessions[eAddr]["bgcol"]
          })
        }
      }
    }
  )
})


////////////////////////////
// Background colour save //
////////////////////////////
fastify.post("/api/saveBgcol", function(req, rep){
  console.log("req.body:", req.body)
  const magicLink = req.body.authToken
  const bgcol = req.body.bgcol
  if (magicLink === null || bgcol === null){
    rep.code(404).send()
    return
  }

  fs.readFile(
    fnam, "utf8",
    (err, str) => {
      if (err){
        throw err
      }
      else {
        userSessions = JSON.parse(str)
        console.log("userSessions:", userSessions)
        // Find email address associated with the magic link.
        const eAddr = Object.keys(userSessions).find(function(e){
          return userSessions[e].magicLink === magicLink
        })
        console.log("eAddr:", eAddr)

        // Server reply depends on finding associated email address.
        if (eAddr === undefined){
          rep.send({ "msg": "Invalid magic link" })
        }
        else if (
          Date.now() - userSessions[eAddr]["stampCreate"]
          > sessionLength
        ){
          rep.send({ "msg": "Session expired." })
        }
        else {
          userSessions[eAddr]["bgcol"] = bgcol

          fs.writeFile(
            fnam,
            JSON.stringify(userSessions, null, 2),
            {
              "encoding": "utf8"
            },
            (err) => {
              if (err){
                throw err
              }
              else {
                rep.send({
                  "msg": "Background colour saved successfully!"
                })
              }
            }
          )
        }
      }
    }
  )
})



//////////////////////////////
// Obtaining the data layer //
//////////////////////////////
fastify.get("/api/download", async (req, reply) => {
  reply.header("Content-Type", "application/zip");
  reply.header(
    "Content-Disposition",
    "attachment; filename=data-files.zip"
  );

  const archive = archiver("zip", { zlib: { level: 9 } });

  // stream archive directly to client
  archive.pipe(reply.raw);

  // only include the "data" folder
  const dataDir = path.join(__dirname, "data");
  archive.directory(dataDir, false);

  await archive.finalize();

  return reply;
});



//////////////////////////////////////
// The nodemailer part in isolation //
//////////////////////////////////////
fastify.post('/api/sendMail', function(req, rep){
  console.log("req.body:", req.body)

  // Set up e-mail data.
  const mailOptions = {
    from: '"'+req.body.author+'" <'+process.env.TEST_SENDER+'>', // Sender address
    to: process.env.TEST_RECIPIENT, // List of receivers
    subject: 'Test Mail', // Subject line
    text: req.body.text, // Plaintext body
    html: '<b>'+req.body.text+'</b>' // HTML body
  }

  // Send mail with defined transport object.
  transporter.sendMail(mailOptions, function(error, info){
    if(error){
      return console.log(error)
    }
    console.log('Message sent: ' + info.response)

    const mailDetails = {
      id: Date.now(),
      author: "From: " + req.body.author + " <" + process.env.TEST_SENDER + ">, To: " + process.env.TEST_RECIPIENT,
      text: "Saying: " + req.body.text,
    }

    rep.send({
      "hello": "blah blah"
    })

  })
})


// Run the server and report out to the logs.
const PORT = process.env.PORT || 3000;
fastify.listen({ port: PORT, host: "0.0.0.0" }, function(err, address){
  if (err){
    fastify.log.error(err)
    process.exit(1)
  }
  console.log(`Your app is listening on ${address}`)
  fastify.log.info(`server listening on ${address}`)
})
