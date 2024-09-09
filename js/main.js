let APP_ID = "4df38e3b94dc4c5dad3fedd583cee6b0";

let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;

let localStream;
let remoteStream;
let peerConnection;

/* Setup the server */
const server = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
};

let init = async () => {
    client = await AgoraRTM.createInstance(APP_ID);

    await client.login({ uid, token });
    channel = client.createChannel('main');
    console.log("Channel 'main' created.");

    await channel.join();
    console.log("Joined channel 'main'.");

    channel.on('MemberJoined', handleUserJoin);

    client.on('MessageFromPeer', handleMessagePeer);

    /* Access the camera to stream */
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    document.getElementById('user-1').srcObject = localStream;
};

let handleMessagePeer = async (message, MemberId) => {
    message = JSON.parse(message.text);

    if (message.type === 'offer') {
        createAnswer(MemberId, message.offer);
    }
    if (message.type === 'answer') {
        addAnswer(message.answer);
    }
    if (message.type === 'candidate') {
        if (peerConnection) {
            peerConnection.addIceCandidate(message.candidate);
        }
    }
};

let handleUserJoin = async (MemberId) => {
    console.log("New user joined the channel:", MemberId);
    createOffer(MemberId);
};

let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(server);
    remoteStream = new MediaStream();
    document.getElementById('user-2').srcObject = remoteStream;
    document.getElementById('user-2').style.display='block'

    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        document.getElementById('user-1').srcObject = localStream;
    }

    /* Add local tracks to the peer connection */
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        });
    };

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            client.sendMessageToPeer({ text: JSON.stringify({ type: 'candidate', candidate: event.candidate }) }, MemberId);
        }
    };
};

/* Create an offer for the peer connection */
let createOffer = async (MemberId) => {
    await createPeerConnection(MemberId);

    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    client.sendMessageToPeer({ text: JSON.stringify({ type: 'offer', offer: offer }) }, MemberId);
    console.log(offer);
};

/* Create an answer for the received offer */
let createAnswer = async (MemberId, offer) => {
    await createPeerConnection(MemberId);

    // Modification: Use RTCSessionDescription to set the correct type for the offer
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    client.sendMessageToPeer({ text: JSON.stringify({ type: 'answer', answer: answer }) }, MemberId);
};

/* Add answer to the peer connection */
let addAnswer = async (answer) => {
    // Modification: Use RTCSessionDescription to set the correct type for the answer
    if (!peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
};

init();
