import { broadcast } from '@/networking.js'

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("button").onclick = () => {
        broadcast(document.getElementById("messageToSend").value)
    }
})
