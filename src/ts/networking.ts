import { initGame, nextTurn, readGameUpdate, runAction, sendGameUpdate } from "./game.js";
import { addMessage } from "./log.js";
import { startGame, updateLobbyPanel, updatePlayPanel, updateUserPanel } from "./ui.js";

const dataTypes = ["message", "userInit", "userData", "discard", "play", "draw", "gameUpdate", "startGame"] as const

let connections = new Map<string, any>()
export let users = new Map<string, User>()
export let isHost = null
let conn = null
export let peer = null

export function initUser(name: string) {
    //@ts-ignore
    peer = new Peer({debug:3});
    let params = new URLSearchParams(window.location.search)
    let q = params.get("host")
    peer.on('open', function(id) {
        users.set(id, new User(id, name))
        console.log('My peer ID is: ' + id);
        if (q == null) {
            peer.on('connection', onUserJoin);
            isHost = true
            updateLobbyPanel()
            updateUserPanel(users, id)
        } else {
            conn = peer.connect(q);
            conn.on('open', function() {
                conn.send({
                    source: id,
                    type: "userInit",
                    value: users.get(id)
                })
            })
            conn.on('data', function(data) {
                console.log('Received', data);
                console.log("hi")
                if (data.type == "message")
                    addMessage(users.get(data.source).name, data.value)
                else if (data.type == "userData") {
                    users.clear()
                    JSON.parse(data.value).forEach(u => users.set(u[0], u[1]))
                    console.log(users)
                    updateLobbyPanel()
                    updateUserPanel(users, peer.id)
                } else if (data.type == "gameUpdate") { 
                    readGameUpdate(JSON.parse(data.value))
                } else if (data.type == "startGame") {
                    startGame()
                }
                    
            });
            isHost = false
        }
    });
}

let onUserJoin = (c) => { // runs only for host
    conn = c
    alert("someone joined!")
    
    c.on('open', () => { 
        setTimeout(() => { // wait and see if they tell us info about themselves
            if (users.get(c.peer) == undefined) { // we didn't get a response
                c.close()
            } // we good
        }, 1000)
    })
    c.on('data', function(data) {
        console.log('Received', data);
        if (data.type == "message") {
            addMessage(users.get(data.source).name, data.value)
            propagate(data)
        } else if (data.type == "userInit") { // we got the handshake
            users.set(c.peer, new User(data.value.id, data.value.name)) // add new user
            updateLobbyPanel()
            updateUserPanel(users, peer.id) // update userspanel
            connections.set(c.peer, c) // add the new connection
            connections.forEach((v) =>  // init everyone including the new player
                v.send({
                    source: peer.id,
                    type: "userData",
                    value: JSON.stringify([...users])
                })
            )
        } else if (data.type == "play") { // we get play info
            runAction(JSON.parse(data.value), data.source)
            nextTurn()
            updatePlayPanel()
            sendGameUpdate()
        }
    }); 
    c.on('close', function() {
        users.delete(c.peer)
        connections.delete(c.peer)
        updateUserPanel(users, peer.id)
        propagate({
            source: peer.id,
            type: "userData",
            value: JSON.stringify([...users])
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

export let broadcastMessage = (message: string) => {
    broadcast({
        source: peer.id,
        type: "message",
        value: message
    })
}

export let sendDataMessage = (id: string, data: DataMessage) => {
    connections.get(id).send(data)
}

export let broadcast = (data: DataMessage) => {
    if (conn == null) {
        return;
    }
    if (!isHost) { // client
        conn.send(data)
        return
    }
    propagate(data)   
}

// host only
export let message = (data: DataMessage, target: User) => {
    if (!isHost) {
        return
    }
    connections.get(target.id).send(data)
}

export type DataMessage = {
    source: string, 
    type: typeof dataTypes[number], 
    value: string
}

export class User {

    id: string
    name: string

    constructor(id: string, name: string) {
        this.id = id
        this.name = name
    }

}