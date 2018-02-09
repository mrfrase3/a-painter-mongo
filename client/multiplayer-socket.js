if(io) window.socket = io.connect();

socket.on('giveOwner', owner => {
    socket.owner = owner;
});


AFRAME.registerComponent('multiplayer-socket', {
  schema: {
    joinedRoom: {type: 'string'}
  },
  init: function(){
    this.socket = null;
    this.msystem = document.querySelector('a-scene').systems['multiplayer'];
    this.strokeBuffer = [];
    this.lastBufferProcess = 0;
    this.currentRoom = null;

    if(socket) {
      this.socket = socket;
      var self = this;
      self.socket.emit('joinRoom', self.data.joinedRoom);
      console.log(self.data.joinedRoom);

      this.socket.on('joinedRoom', function(history){
        self.currentRoom = self.data.joinedRoom;
        console.log("successfully joined a session");
        document.querySelector('a-scene').systems['brush'].clear();
        for(var i in history){
          self.strokeBuffer.push({stroke: history[i].stroke});
          self.strokeBuffer.push([history[i]]);
        }
      });

      this.socket.on('removeStroke', function(event){
        if(event.stroke.owner === self.socket.owner) event.stroke.owner = 'local';
        self.msystem.removeStoke(event);
      });

      this.socket.on('newStroke', function(event){
        if(event.stroke.owner === self.socket.owner) return;
        self.strokeBuffer.push(event);
      });

      this.socket.on('newPoints', function(event){
        if(!event[0] || event[0].stroke.owner === self.socket.owner) return;
        self.strokeBuffer.push(event);
      });

      this.socket.on('moveVR', function(event){
        if(event.owner === self.socket.owner) return;
        self.msystem.moveVR(event);
      });

      this.socket.on('exitVR', function(event){
        if(event.owner === self.socket.owner) return;
        self.msystem.exitVR(event);
      });

      this.msystem.onNewStroke = function(event){this.socket.emit('newStroke', event);};
      this.msystem.onRemoveStroke = function(event){this.socket.emit('removeStroke', event);};
      this.msystem.onNewPoints = function(event){this.socket.emit('newPoints', event);};
      this.msystem.onMoveVR = function(event){this.socket.emit('moveVR', event);};
      this.msystem.onExitVR = function(){this.socket.emit('exitVR');};
    }
  },

  tick: function (time, delta) {
    if(time - this.lastBufferProcess >= 33){
      this.lastBufferProcess = time;
      let len = Math.min(Number(this.strokeBuffer.length), 20);
      for(let i = 0; i < len; i++){ //don't do more than 20
        let event = this.strokeBuffer.shift();
        if(Array.isArray(event)) this.msystem.newPoints(event);
        else this.msystem.newStoke(event);
      }
    }
  }
});


/*
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
})();*/
