AFRAME.registerComponent('multiplayer', {
    schema: {
        joinedRoom: {type: 'string'}
    },
    init: function(){
        this.socket = null;
        this.system = document.querySelector('a-scene').systems['multiplayer']; //for some reason custom functions aren't initiating properly
        this.strokeBuffer = [];
        this.lastBufferProcess = 0;

        if(io) {
            this.socket = io.connect();
            var self = this;

            this.socket.on('giveOwner', owner => {
                self.socket.owner = owner;
            self.socket.emit('joinRoom', self.data.joinedRoom);
            console.log(self.data.joinedRoom);
        });

            this.socket.on('joinedRoom', history => {
                console.log("successfully joined a session");
            document.querySelector('a-scene').systems['brush'].clear();
            for(let i in history){
                this.strokeBuffer.push({stroke: history[i].stroke});
                this.strokeBuffer.push([history[i]]);
            }
        });

            this.socket.on('removeStroke', event => {
                if(event.stroke.owner === self.socket.owner) event.stroke.owner = 'local';
            this.system.removeStoke(event);
        });

            this.socket.on('newStroke', event => {
                if(event.stroke.owner === self.socket.owner) return;
            this.strokeBuffer.push(event);
        });

            this.socket.on('newPoints', event => {
                if(!event[0] || event[0].stroke.owner === self.socket.owner) return;
            this.strokeBuffer.push(event);
        });

            this.socket.on('userMove', event => {
                if(event.owner === self.socket.owner) return;
            this.system.userMove(event);
        });

            this.socket.on('userLeave', event => {
                if(event.owner === self.socket.owner) return;
            this.system.userLeave(event);
        });

            this.system.onNewStroke = event => this.socket.emit('newStroke', event);
            this.system.onRemoveStroke = event => this.socket.emit('removeStroke', event);
            this.system.onNewPoints = event => this.socket.emit('newPoints', event);
            this.system.onUserMove = event => this.socket.emit('userMove', event);
            this.system.onUserLeave = () => this.socket.emit('userLeave');
        }
    },

    tick: function (time, delta) {
        if(time - this.lastBufferProcess >= 33){
            this.lastBufferProcess = time;
            let len = Math.min(Number(this.strokeBuffer.length), 20);
            for(let i = 0; i < len; i++){ //don't do more than 20
                let event = this.strokeBuffer.shift();
                if(Array.isArray(event)) this.system.newPoints(event);
                else this.system.newStoke(event);
            }
        }
    }
});

(()=>{
    var el = document.createElement('a-entity');
var room = "";
var search = new URLSearchParams(window.location.search);
room = search.get("room");
if(!room){
    room = Math.random().toString(36).substr(2, 8);
    search.set("room", room);
    var query = window.location.pathname + '?' + search.toString();
    history.pushState(null, '', query);
}
el.setAttribute('multiplayer', 'joinedRoom:'+room+';');
document.querySelector('a-scene').appendChild(el);
})();