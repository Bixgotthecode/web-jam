/* global io, Nexus, Tone */

const socket = io()
const params = new URLSearchParams(window.location.search)
const credentials = {
  invitationId: params.get("invite"),
  playerToken: params.get("player")
}
const turnStatus = document.getElementById("turnStatus")
const pianoShell = document.getElementById("pianoShell")
const melodyList = document.getElementById("melody")
const gameError = document.getElementById("gameError")

let playerIndex = null
let currentGame = { melody: [], turnIndex: 0, bpm: 120 }
let audioStarted = false
let playbackIndex = 0
let melodyLoopStarted = false

const synth = new Tone.PolySynth(Tone.Synth).toDestination()
synth.set({
  oscillator: { type: "triangle" },
  envelope: { attack: 0.01, decay: 0.1, sustain: 0.25, release: 0.35 }
})
Tone.Transport.bpm.value = 120

// Keep one quarter-note clock running. It reads the current shared melody on
// each beat, so adding notes does not restart or layer another playback loop.
const melodyLoop = new Tone.Loop(time => {
  if (currentGame.melody.length === 0){
    return
  }

  const midi = currentGame.melody[playbackIndex % currentGame.melody.length]
  synth.triggerAttackRelease(noteName(midi), "4n", time)
  playbackIndex = (playbackIndex + 1) % currentGame.melody.length
}, "4n")

const piano = new Nexus.Piano("#piano", {
  size: [640, 150],
  mode: "button",
  lowNote: 48,
  highNote: 72
})

function noteName(midi){
  return Tone.Frequency(midi, "midi").toNote()
}

function updateInterface(){
  const isMyTurn = playerIndex === currentGame.turnIndex
  pianoShell.classList.toggle("is-waiting", !isMyTurn)
  turnStatus.textContent = isMyTurn ? "Your turn: add one quarter note." : "Waiting for the other player…"
 
  melodyList.replaceChildren()  // clear the list 
  currentGame.melody.forEach(midi => {
    const item = document.createElement("li")
    item.textContent = noteName(midi)
    melodyList.appendChild(item)
  })
}

function startMelodyLoop(){
  if (!audioStarted || melodyLoopStarted || currentGame.melody.length === 0){
    return
  }

  playbackIndex = 0
  melodyLoop.start("+0.05")
  Tone.Transport.start("+0.05")
  melodyLoopStarted = true
}

async function startAudio(){
  if (!audioStarted){
    await Tone.start()
    audioStarted = true
    startMelodyLoop()
  }
}

piano.on("change", async event => {
  if (!event.state || playerIndex !== currentGame.turnIndex){
    return
  }
  gameError.textContent = ""
  try {
    await startAudio()
    socket.emit("add-note", event.note)
  }
  catch (err){
    gameError.textContent = "Audio could not start. Check your browser's audio permissions."
  }
})

socket.on("connect", () => {
  if (!credentials.invitationId || !credentials.playerToken){
    gameError.textContent = "This game link is incomplete."
    return
  }
  socket.emit("join-game-room", credentials)
})

socket.on("game-state", state => {
  if (Number.isInteger(state.playerIndex)){
    playerIndex = state.playerIndex
  }
  currentGame = state
  updateInterface()
  startMelodyLoop()
})

socket.on("game-error", message => {
  gameError.textContent = message
})

socket.on("invitation-error", message => {
  gameError.textContent = message
  pianoShell.classList.add("is-waiting")
})
