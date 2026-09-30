/* global io */

const socket = io()
const invitationForm = document.getElementById("invitationForm")
const statusMessage = document.getElementById("invitationStatus")
const sendButton = document.getElementById("sendInvitation")

function setStatus(message, isError = false){
  statusMessage.textContent = message
  statusMessage.style.color = isError ? "#a40000" : "#000000"
}

function roomCredentials(){
  const params = new URLSearchParams(window.location.search)
  return {
    invitationId: params.get("invite"),
    playerToken: params.get("player")
  }
}

function enterGameRoom(){
  window.location.assign("/game-room" + window.location.search)
}

socket.on("connect", () => {
  const credentials = roomCredentials()
  if (credentials.invitationId && credentials.playerToken){
    invitationForm.hidden = true
    socket.emit("join-invitation", credentials)
    setStatus("Joining the game room…")
  }
})

socket.on("game-ready", () => {
  enterGameRoom()
})

socket.on("invitation-error", message => {
  setStatus(message, true)
})

invitationForm.addEventListener("submit", async event => {
  event.preventDefault()
  if (!socket.connected){
    setStatus("Connecting to the collaboration service. Please try again in a moment.", true)
    return
  }

  sendButton.disabled = true
  setStatus("Sending invitation…")
  const inviteeEmail = document.getElementById("inviteeEmail").value.trim()

  try {
    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteeEmail, socketId: socket.id })
    })
    const data = await response.json()
    if (!response.ok){
      throw new Error(data.msg || "Unable to send the invitation.")
    }
    window.history.replaceState({}, "", data.hostWaitingUrl)
    setStatus("Invite link sent to " + inviteeEmail + ". Waiting for them to join…")
  }
  catch (err){
    setStatus(err.message, true)
    sendButton.disabled = false
  }
})
