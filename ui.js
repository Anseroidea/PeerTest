import { addMessage } from './log.js'
import { broadcast, peer } from './networking.js'

document.addEventListener("DOMContentLoaded", () => {
    //chat

    //send message
    document.getElementById("button").onclick = () => {
        let messageText = document.getElementById("messageToSend").value
        if (messageText.trim().length == 0) {
            return
        }
        addMessage(peer.id, messageText)
        broadcast(document.getElementById("messageToSend").value)
    }




})

export function updateUserPanel(users, user) {
    let usersPanel = document.getElementById("usersPanel")
    usersPanel.replaceChildren(...users.map(u => {
        let userDiv = document.createElement("div")
        userDiv.innerText = u
        if (u == user) {
            userDiv.style.fontWeight = "bold"
        }
        userDiv.style.whiteSpace = "nowrap"
        return userDiv
    }))
    
}


