AFRAME.registerSystem('multiplayer', {
  schema: {},
  init: function(){
    var self = this;
    this.brush = document.querySelector('a-scene').systems['brush'];

    this.lastStokeSendTime = 0;
    this.lastMovementTime = 0;
    this.isTrackingMovement = false;
    this.userElements = {
      lhand: document.getElementById('left-hand'),
      rhand: document.getElementById('right-hand'),
      head: document.getElementById('acamera')
    };
    this.remoteUsers = {};
    this.remoteColors = ['#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c',
      '#fdbf6f','#ff7f00','#cab2d6','#6a3d9a','#ffff99','#a6cee3','#b15928'];

    document.addEventListener('stroke-started', function(event){
      var stroke = event.detail.stroke;
      stroke.data.numPointsSent = 0;
      self.onNewStroke( {timestamp: stroke.data.timestamp, brush: {brushName: stroke.brush.prototype.brushName, color: stroke.data.color.toArray(), size: stroke.data.size}});
      stroke.entity.addEventListener('stroke-removed', function(r_event){
        self.onRemoveStroke( {timestamp: stroke.data.timestamp});
      });
    });

    document.querySelector('a-scene').addEventListener('enter-vr', function(event){
      self.isTrackingMovement = true;
      self.onEnterVR();
    });

    document.querySelector('a-scene').addEventListener('exit-vr', function(event){
      self.isTrackingMovement = false;
      self.onExitVR();
    });

    this.onNewStroke = function(event){};
    this.onRemoveStroke = function(event){};
    this.onNewPoints = function(event){};
    this.onMoveVR = function(event){};
    this.onEnterVR = function(){};
    this.onExitVR = function(){};

  },

  findStroke: function(owner, timestamp){
    for(var i = this.brush.strokes.length-1; i >= 0; i--){ // the stroke being looked for is most likely at the end of the array
      if(this.brush.strokes[i].data.owner === owner && this.brush.strokes[i].data.timestamp === timestamp){
        return {stroke: this.brush.strokes[i], index: i};
      }
    }
    return {stroke: null, index: -1};
  },

  removeStoke: function(event) {
    var res = this.findStroke(event.stroke.owner || 'remote', event.stroke.timestamp);
    if(res.index === -1) return;
    res.stroke.entity.parentNode.removeChild(res.stroke.entity);
    this.brush.strokes.splice(res.index, 1);
  },

  newStoke: function(event) {
    var color = (new THREE.Color()).fromArray(event.brush.color);
    this.brush.addNewStroke(event.brush.brushName, color, event.brush.size, event.owner || 'remote', event.timestamp);
  },

  newPoints: function(event) {
    for(var i = 0; i < event.length; i++){
      var res = this.findStroke(event[i].owner || 'remote', event[i].timestamp);
      if(res.index === -1) continue;
      for(var j = 0; j < event[i].points.length; j++){
        var point = event[i].points[j];
        var position = (new THREE.Vector3()).fromArray(point.position);
        var orientation = (new THREE.Quaternion()).fromArray(point.orientation);
        var pointerPosition = (new THREE.Vector3()).fromArray(point.pointerPosition);
        res.stroke.addPoint(position, orientation, pointerPosition, point.pressure, point.timestamp);
      }
    }
  },

  exitVR: function(event){
    var ruser = this.remoteUsers[event.owner];
    if(!ruser) return;
    ruser.lhand.setAttribute('visible', false);
    ruser.rhand.setAttribute('visible', false);
    ruser.head.setAttribute('visible', false);
    ruser.visable = false;
  },

  moveVR: function(event){
    var ruser = this.remoteUsers[event.owner];
    if(!ruser){
      var color = this.remoteColors[(Object.keys(this.remoteUsers).length%this.remoteColors.length)];
      //console.log(Object.keys(this.remoteUsers).length +" % "+ this.remoteColors.length);
      ruser = this.remoteUsers[event.owner] = {
        lhand: document.createElement('a-entity'),
        rhand: document.createElement('a-entity'),
        head: document.createElement('a-entity'),
        color,
        visible: true
      };
      ruser.lhand.setAttribute('remote-controls', 'owner: '+event.owner+';color: '+color+';');
      ruser.rhand.setAttribute('remote-controls', 'owner: '+event.owner+';color: '+color+';');
      ruser.head.setAttribute('remote-headset', 'owner: '+event.owner+';color: '+color+';');
      document.querySelector('a-scene').appendChild(ruser.lhand);
      document.querySelector('a-scene').appendChild(ruser.rhand);
      document.querySelector('a-scene').appendChild(ruser.head);
    }
    if(!ruser.visable){
      ruser.lhand.setAttribute('visible', true);
      ruser.rhand.setAttribute('visible', true);
      ruser.head.setAttribute('visible', true);
      ruser.visable = true;
    }
    for(var i in {'lhand':'', 'rhand':'', 'head':''}){
      for(var j in event[i].pos){
        event[i].pos[j] = event[i].pos[j] / 1000.0 //refocus the decimal place
        event[i].rot[j] = event[i].rot[j] / 1000.0 //refocus the decimal place
      }
      ruser[i].setAttribute('position', event[i].pos);
      ruser[i].setAttribute('rotation', event[i].rot);
    }
  },

  sendMovement: function(){
    //being frugal on creating new objects in tick loop
    var currMove = this.currMove = this.currMove || {
      lhand: {pos: {}, rot: {}},
      rhand: {pos: {}, rot: {}},
      head: {pos: {}, rot: {}},
    };
    var lastMove = this.lastMove = this.lastMove || {
      lhand: {pos: {x: 0, y: 0, z: 0}, rot: {x: 0, y: 0, z: 0}},
      rhand: {pos: {x: 0, y: 0, z: 0}, rot: {x: 0, y: 0, z: 0}},
      head: {pos: {x: 0, y: 0, z: 0}, rot: {x: 0, y: 0, z: 0}},
    };
    var posChanged = 0;
    var rotChanged = 0;
    for(var i in this.userElements){
      var pos = this.userElements[i].getAttribute('position');
      var rot = this.userElements[i].getAttribute('rotation');
      for(var j in pos){
        currMove[i].pos[j] = Math.round(pos[j]*1000); //keep 3 digits after decimal
        posChanged += Math.abs(currMove[i].pos[j] - lastMove[i].pos[j]);
        lastMove[i].pos[j] = currMove[i].pos[j];

        currMove[i].rot[j] = Math.round(rot[j]*1000); //keep 3 digits after decimal
        rotChanged += Math.abs(currMove[i].rot[j] - lastMove[i].rot[j]);
        lastMove[i].rot[j] = currMove[i].rot[j];
      }
    }
    if(posChanged > 2/*mm*/ || rotChanged > 200/*0.2 of a degree*/){
      //dont send if under premultiplied threshhold
      this.onMoveVR(currMove);
    }
  },

  sendStrokes: function(){
    var sendStrokes = [];
    for(var i = this.brush.strokes.length-1, c = 0; i >= 0 && c < 4; i--){
      if(this.brush.strokes[i].data.owner !== 'local') continue;
      c++; // go through the 4 most recent strokes
      var stroke = this.brush.strokes[i];
      if(stroke.data.points.length <= stroke.data.numPointsSent) continue;
      var sendPoints = [];
      for(var j = stroke.data.numPointsSent-1; j < stroke.data.points.length; j++){
        if(j < 0) continue;
        sendPoints.push({
          position: stroke.data.points[j].position.toArray(),
          orientation: stroke.data.points[j].orientation.toArray(),
          pointerPosition: this.brush.getPointerPosition(stroke.data.points[j].position, stroke.data.points[j].orientation).toArray(),
          pressure: stroke.data.points[j].pressure,
          timestamp: stroke.data.points[j].timestamp
        });
      }
      stroke.data.numPointsSent = stroke.data.points.length;
      sendStrokes.push({timestamp: stroke.data.timestamp, points: sendPoints});
    }
    if(sendStrokes.length > 0) this.onNewPoints(sendStrokes);
  },

  tick: function (time, delta) {

    if(time - this.lastStokeSendTime >= 33){
      this.lastStokeSendTime = time;
      this.sendStrokes();
    } else if(this.isTrackingMovement && time - this.lastMovementTime >= 33){
      this.lastMovementTime = time;
      this.sendMovement();
    }
  }
});
