

document.addEventListener("DOMContentLoaded", () => {
    var peer = new Peer({debug:3});
    const params = new URLSearchParams(window.location.search)
    const q = params.get("host")
    var isHost = null
    var conn = null
    peer.on('open', function(id) {
        console.log('My peer ID is: ' + id);
        if (q == null) {
            peer.on('connection', function(conn) { 
                alert("someone joined!")
                conn.on('data', function(data) {
                    console.log('Received', data);
                    document.getElementById("messageText").textContent = data
                });
                document.getElementById("button").onclick = () => {
                    conn.send(document.getElementById("messageToSend").value)
                }            
            });
        } else {
            conn = peer.connect(q);
            conn.on('open', function() {
                console.log("hi")
                conn.send('hi')
            })
            conn.on('data', function(data) {
                console.log('Received', data);
                document.getElementById("messageText").textContent = data
            });
            document.getElementById("button").onclick = () => {
                conn.send(document.getElementById("messageToSend").value)
            }
        
        }
    }); 

    

    
})
