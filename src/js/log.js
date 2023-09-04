export function addMessage(source, text) {
    let message = document.createElement("div");
    let author = document.createElement("h6");
    author.textContent = source;
    message.appendChild(author);
    let messageText = document.createElement("div");
    messageText.textContent = text;
    message.appendChild(messageText);
    document.getElementById("chatPanel").appendChild(message);
}
