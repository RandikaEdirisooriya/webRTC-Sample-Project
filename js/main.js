let APP_ID = "4df38e3b94dc4c5dad3fedd583cee6b0";

let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get('room');

if (!roomId) {
    window.location = 'lobby.html'; // Redirect to lobby if no room ID is present
}

let localStream;
let peerConnections = {}; // To hold multiple peer connections for multiple participants

/* Setup the server */
const server = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
};

let constraints = {
    video: {
        width: { min: 640, ideal: 1920, max: 1920 },
        height: { min: 480, ideal: 1080, max: 1080 },
    },
    audio: true
};

let init = async () => {
    client = await AgoraRTM.createInstance(APP_ID);

    await client.login({ uid, token });
    channel = client.createChannel(roomId);
    console.log(`Channel '${roomId}' created.`);

    await channel.join();
    console.log(`Joined channel '${roomId}'.`);

    channel.on('MemberJoined', handleUserJoin);
    channel.on('MemberLeft', handleUserLeft);

    client.on('MessageFromPeer', handleMessagePeer);

    /* Access the camera to stream */
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    document.getElementById('user-1').srcObject = localStream;
};

let handleUserLeft = async (MemberId) => {
    console.log("User left the channel:", MemberId);
    document.getElementById('user-2').style.display = 'none';
    document.getElementById('user-1').classList.remove('smallFrame');

    // Close and remove the peer connection
    if (peerConnections[MemberId]) {
        peerConnections[MemberId].close();
        delete peerConnections[MemberId];
    }
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
        if (peerConnections[MemberId]) {
            peerConnections[MemberId].addIceCandidate(new RTCIceCandidate(message.candidate));
        }
    }
};

let handleUserJoin = async (MemberId) => {
    console.log("New user joined the channel:", MemberId);
    await createOffer(MemberId);
};

let createPeerConnection = async (MemberId) => {
    let peerConnection = new RTCPeerConnection(server);
    let remoteStream = new MediaStream();

    document.getElementById('user-2').srcObject = remoteStream;
    document.getElementById('user-2').style.display = 'block';
    document.getElementById('user-1').classList.add('smallFrame');

    /* Add local tracks to the peer connection */
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    /* Handle incoming tracks */
    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        });
    };

    /* Handle ICE candidates */
    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            client.sendMessageToPeer(
                { text: JSON.stringify({ type: 'candidate', candidate: event.candidate }) },
                MemberId
            );
        }
    };

    /* Store the peer connection for this member */
    peerConnections[MemberId] = peerConnection;
};

let createOffer = async (MemberId) => {
    let peerConnection = await createPeerConnection(MemberId);

    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    client.sendMessageToPeer(
        { text: JSON.stringify({ type: 'offer', offer: offer }) },
        MemberId
    );
    console.log("Offer sent:", offer);
};

let createAnswer = async (MemberId, offer) => {
    let peerConnection = await createPeerConnection(MemberId);

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    client.sendMessageToPeer(
        { text: JSON.stringify({ type: 'answer', answer: answer }) },
        MemberId
    );
    console.log("Answer sent:", answer);
};

let addAnswer = async (answer) => {
    let peerConnection = peerConnections[Object.keys(peerConnections)[0]]; // Get the first connection for simplicity
    if (peerConnection && !peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("Answer added:", answer);
    }
};

let leaveChannel = async () => {
    await channel.leave();
    await client.logout();
};

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video');
    if (videoTrack.enabled) {
        videoTrack.enabled = false;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255,80,80)';
    } else {
        videoTrack.enabled = true;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179,102,249,.9)';
    }
};

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio');
    if (audioTrack.enabled) {
        audioTrack.enabled = false;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255,80,80)';
    } else {
        audioTrack.enabled = true;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179,102,249,.9)';
    }
};

window.addEventListener('beforeunload', leaveChannel);

// Correct event listeners
document.getElementById('camera-btn').addEventListener('click', toggleCamera);
document.getElementById('mic-btn').addEventListener('click', toggleMic);

init();
