import { addMessage } from "./log.js";
import { updateUserPanel } from "./ui.js";

var connections = new Map()
var users = []
export var peer = new Peer({debug:3});
const params = new URLSearchParams(window.location.search)
const q = params.get("host")
var isHost = null
var conn = null
peer.on('open', function(id) {
    users.push(id)
    console.log('My peer ID is: ' + id);
    if (q == null) {
        peer.on('connection', onUserJoin);
        isHost = true
        updateUserPanel(users, id)
    } else {
        conn = peer.connect(q);
        conn.on('open', function() {

        })
        conn.on('data', function(data) {
            console.log('Received', data);
            console.log("hi")
            if (data.type == "message")
            addMessage(data.source, data.value)
            else if (data.type == "userData") {
                users = data.value
                updateUserPanel(users, peer.id)
            }
                
        });
        isHost = false
    
    }
});
var onUserJoin = (c) => { // runs only for host
    conn = c
    alert("someone joined!")
    users.push(c.peer) // add new user
    updateUserPanel(users, peer.id) // update userspanel
    connections.set(c.peer, c) // add the new connection
    c.on('open', () => { // init everyone including the new player
        connections.forEach((v) => 
            v.send({
                source: peer.id,
                type: "userData",
                value: users
            })
        )
    })
    c.on('data', function(data) {
        console.log('Received', data);
        if (data.type == "message") {
            addMessage(data.source, data.value)
            propagate(data)
        }
    }); 
    c.on('close', function() {
        users.splice(users.indexOf(c.peer), 1)
        console.log(users)
        connections.delete(c.peer)
        updateUserPanel(users, peer.id)
        propagate({
            source: peer.id,
            type: "userData",
            value: users
        })
    });
}


let propagate = (data) => {  // only host runs
    console.log(connections);
    [...connections].filter(([k, ]) => k != data.source).forEach(([, v]) => {
        console.log(v)
        v.send(data)
    })
}

export let broadcast = (message) => {
    if (conn == null) {
        return;
    } 
    let data = {
        source: peer.id,
        type: "message",
        value: message
    }
    if (!isHost) { // client
        conn.send(data)
        return
    }
    propagate(data)
    
}