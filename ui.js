import { addMessage } from './log.js'
import { broadcast, initUser, users, peer } from './networking.js'

document.addEventListener("DOMContentLoaded", () => {
    // init send message
    document.getElementById("messageToSend").addEventListener("keyup", (event) => {
        if (event.code !== "Enter") {
            return;
        }
        let messageText = document.getElementById("messageToSend").value
        document.getElementById("messageToSend").value = ""
        if (messageText.trim().length == 0) {
            return
        }
        addMessage(users.get(peer.id).name, messageText)
        broadcast(messageText)
    })

    // init name submission button and enter key
    document.getElementById("nameJoinButton").onclick = submitName
    document.getElementById("nameInput").addEventListener("keyup", (event) => {
        if (event.code !== "Enter") {
            return;
        }
        submitName()
    })

    // init copy link
    document.getElementById("copyLinkButton").onclick = () => {
        navigator.clipboard.writeText("https://ansere.github.io/PeerTest?host=" + peer.id)
        bootstrap.Toast.getOrCreateInstance(document.getElementById("copiedToast")).show()
    }

    // ask for name
    bootstrap.Modal.getOrCreateInstance("#nameModal").show()

    // init start game

    document.getElementById("startGameButton").onclick = () => {
        document.getElementById("lobbyPanel").hidden = true
    }


})

export function updateUserPanel(users, user) {
    let usersPanel = document.getElementById("usersPanel")
    usersPanel.replaceChildren(...[...users].map(([, u]) => {
        let userDiv = document.createElement("div")
        userDiv.innerText = u.name
        if (u.id == user) {
            userDiv.style.fontWeight = "bold"
        }
        userDiv.style.whiteSpace = "nowrap"
        return userDiv
    }))
    
}

function submitName() {
    let nameValue = document.getElementById("nameInput").value
    if (nameValue.trim().length == 0) {
        document.getElementById("errorNameLabel").hidden = false
    } else {
        bootstrap.Modal.getOrCreateInstance('#nameModal').hide()
        initUser(nameValue.trim())
    }
}


