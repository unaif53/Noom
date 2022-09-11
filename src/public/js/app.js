const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;
let myDataChannel;
let myNickname;

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const currentCamera = myStream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
}

async function getMedia(deviceId) {
  const initialConstraints = {
    audio: true,
    video: { facingMode: "user" },
  };
  const cameraConstraints = {
    audeo: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstraints
    );
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(e);
  }
}

function handleMuteClick() {
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (!muted) {
    muteBtn.classList.remove("on");
    muteBtn.classList.add("off");
    muted = true;
  } else {
    muteBtn.classList.remove("off");
    muteBtn.classList.add("on");
    muted = false;
  }
}
function handleCameraClick() {
  myStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (cameraOff) {
    cameraBtn.classList.remove("off");
    cameraBtn.classList.add("on");
    cameraOff = false;
  } else {
    cameraBtn.classList.remove("on");
    cameraBtn.classList.add("off");
    cameraOff = true;
  }
}

async function handleCameraChange() {
  await getMedia(camerasSelect.value);
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection
      .getSenders()
      .find((sender) => sender.track.kind === "video");
    videoSender.replaceTrack(videoTrack);
  }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Welcome Form (join a room)

const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall() {
  welcome.hidden = true;
  call.hidden = false;
  const h3 = call.querySelector("h3");
  h3.innerText = `Room [${roomName}]`;
  await getMedia();
  makeConnection();
}

async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  roomName = input.value;
  await initCall();
  socket.emit("join_room", input.value);
  input.value = "";
}

async function handleRoomnameClick(event) {
  event.preventDefault();
  console.log(event);
  roomName = event.srcElement.id;
  await initCall();
  socket.emit("join_room", roomName);
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// Chat Code

const chat = document.getElementById("chat");
const nicknameForm = chat.querySelector("#nickname");
const msgForm = chat.querySelector("#msg");

function addMessage(msg) {
  const ul = chat.querySelector("ul");
  const li = document.createElement("li");
  li.innerText = msg;
  ul.appendChild(li);
}

function handleNicknameSubmit(event) {
  event.preventDefault();
  const input = nicknameForm.querySelector("input");
  myNickname = input.value;
  socket.emit("nickname", myNickname);
}

function handleMessageSubmit(event) {
  event.preventDefault();
  const input = msgForm.querySelector("input");
  const value = input.value;
  myDataChannel.send(`${myNickname}: ${value}`);
  addMessage(`You: ${value}`);
  input.value = "";
}

msgForm.addEventListener("submit", handleMessageSubmit);
nicknameForm.addEventListener("submit", handleNicknameSubmit);

// Socket Code

socket.on("welcome", async (user) => {
  addMessage(`${user} join the room [${roomName}]!`);
  myDataChannel = myPeerConnection.createDataChannel("chat");
  myDataChannel.addEventListener("message", (event) => {
    addMessage(event.data);
  });
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  // console.log("sent the offer");
  socket.emit("offer", offer, roomName);
});

socket.on("offer", async (offer) => {
  myPeerConnection.addEventListener("datachannel", (event) => {
    myDataChannel = event.channel;
    myDataChannel.addEventListener("message", (event) => {
      addMessage(event.data);
    });
  });
  // console.log("received the offer");
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
  // console.log("sent the answer");
});

socket.on("answer", (answer) => {
  // console.log("received the answer");
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  // console.log("received candidate");
  myPeerConnection.addIceCandidate(ice);
});

socket.on("room_change", (roomLists) => {
  // console.log(roomLists);
  const roomNames = welcome.querySelector("ul");
  roomNames.innerHTML = "";
  roomLists.forEach((room) => {
    const li = document.createElement("li");
    const currentRooms = document.createElement("span");
    const enter = document.createElement("button");
    enter.innerText = "Enter";
    enter.id = room;
    currentRooms.innerText = room;
    currentRooms.id = room;
    enter.addEventListener("click", handleRoomnameClick);
    li.appendChild(currentRooms);
    li.appendChild(enter);
    roomNames.appendChild(li);
  });
});

socket.on("bye", (user) => {
  addMessage(`${user} left the room [${roomName}]...`);
});

// RTC Code

function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302",
        ],
      },
    ],
  });
  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("addstream", handleAddStream);
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
  // console.log("send candidate");
  socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
  const peerFace = document.getElementById("peerFace");
  peerFace.srcObject = data.stream;
}
