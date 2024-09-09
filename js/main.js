let APP_ID = "4df38e3b94dc4c5dad3fedd583cee6b0";

let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;

let queryString=window.location.search
let urlParams=new URLSearchParams(queryString)
let roomId=urlParams.get('room')

if(!roomId){
    window.location='lobby.html'
}
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
let  constraints={
    video:{
        width:{min:640, ideal:1920, max:1920},
        height:{min:480, ideal:1080, max:1080},
    },
    audio:true
}
let init = async () => {
    client = await AgoraRTM.createInstance(APP_ID);

    await client.login({ uid, token });
    channel = client.createChannel(roomId);
    console.log("Channel 'main' created.");

    await channel.join();
    console.log("Joined channel 'main'.");

    channel.on('MemberJoined', handleUserJoin);
    channel.on('MemberLeft',hadleUserLeft)

    client.on('MessageFromPeer', handleMessagePeer);

    /* Access the camera to stream */
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    document.getElementById('user-1').srcObject = localStream;
};
let hadleUserLeft=async (MemberId)=>{
    document.getElementById('user-2').style.display='none'
    document.getElementById('user-1').classList.remove('smallFrame')

}
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
    document.getElementById('user-1').classList.add('smallFrame')

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

let leaveChannel=async ()=>{
    await channel.leave()
    await client.logout();
}
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

// Correcting event listeners to pass function references
document.getElementById('camera-btn').addEventListener('click', toggleCamera);
document.getElementById('mic-btn').addEventListener('click', toggleMic);
init();
