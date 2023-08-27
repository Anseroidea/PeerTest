import { addMessage } from './log.js'
import { broadcast, initUser, users, peer } from './networking.js'

document.addEventListener("DOMContentLoaded", () => {
    // init send message
    document.getElementById("button").onclick = () => {
        let messageText = document.getElementById("messageToSend").value
        document.getElementById("messageToSend").value = ""
        if (messageText.trim().length == 0) {
            return
        }
        addMessage(users.get(peer.id).name, messageText)
        broadcast(messageText)
    }

    // init name submission button
    document.getElementById("nameJoinButton").onclick = submitName

    // ask for name
    bootstrap.Modal.getOrCreateInstance("#nameModal").show()


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


