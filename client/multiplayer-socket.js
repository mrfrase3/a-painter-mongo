const firebase = require('firebase');

const firebaseApp = firebase.initializeApp({
  apiKey: "AIzaSyAllS0mWhYOaMR7NCZIW7Rtob5ckfbeGJE",
  authDomain: "a-painter-makeuwa.firebaseapp.com",
  databaseURL: "https://a-painter-makeuwa.firebaseio.com",
  projectId: "a-painter-makeuwa",
  storageBucket: "a-painter-makeuwa.appspot.com",
  messagingSenderId: "14548379311"
});


///////////////////////// Need to add username question



const $multiplayer_firebase = $('<a-entity>', {'multiplayer-firebase', ''});
document.querySelector('a-scene').appendChild($multiplayer_firebase.get(0));

const showPainting = (room) => {
  $('#loginMenuContainer,#roomsMenuContainer,#manageRoomMenuContainer,.returnBtn').hide();
  if(Number($('.manageBtn').attr('data-is-owner'))) $('.manageBtn').show();
  $('.changeBtn').show();
  if(typeof room === string) $multiplayer_firebase.attr('multiplayer-firebase', 'joinedRoom:'+room+';');
}

const showRooms = () => {
  $('#loginMenuContainer,#manageRoomMenuContainer,.changeBtn').hide();
  $('.returnBtn,#roomsMenuContainer').show();
}

const finishLogin = user =>{
  if(user.isAnonymous) $('.loginBtn').show();
  $('.logoutBtn').show();
  search = new URLSearchParams(window.location.search);
  room = search.get("room");
  if(room) return showPainting(room);
  showRooms();
}

const showLogin = () => {
  const user = firebase.auth().currentUser;
  if(user && !user.isAnonymous) return;
  else if(user){
    $(".loginAnon, .loginBtn").hide();
  }
  else $(".loginAnon").show();
  $(".loginForm > h6").removeClass('red-text').text("Login / Sign Up");
  $('#roomsMenuContainer,#manageRoomMenuContainer').hide();
  $('#loginMenuContainer').show();
}

$('.loginBtn').click(showLogin);
$('.logoutBtn').click(()=>firebase.auth().signOut());
$('.returnBtn').click(showPainting);
$('.changeBtn').click(showRooms);

$(".loginForm").submit(function(e){
  e.preventDefault();
  const email = $("#loginMenuEmail").val().trim();
  const password = $("#loginMenuPassword").val();
  const user = firebase.auth().currentUser;
  if(user && !user.isAnonymous) return $(".loginForm > h6").addClass('red-text').text("Error: You are already logged in, please refresh the page.");
  else if(user && user.isAnonymous){
    const credential = firebase.auth.EmailAuthProvider.credential(email, password);
    return user.link(credential).then(finishLogin, function(err) {
      $(".loginForm > h6").addClass('red-text').text("Error: " + err.message);
    });
  } else {
    firebase.auth().signInWithEmailAndPassword(email, password).catch(err => {
      if(err.code !== 'auth/user-not-found') return $(".loginForm > h6").addClass('red-text').text("Error: " + err.message);
      firebase.auth().createUserWithEmailAndPassword(email, password).catch(err => {
        $(".loginForm > h6").addClass('red-text').text("Error: " + err.message);
      });
    });
  }
});

const oAuthLogin = provider => {
  const user = firebase.auth().currentUser;
  if(user && !user.isAnonymous) return $(".loginForm > h6").addClass('red-text').text("Error: You are already logged in, please refresh the page.");
  else if(user && user.isAnonymous){
    return user.linkWithPopup(new provider())
    .then(result => finishLogin(result.user)).catch(err => {
      $(".loginForm > h6").addClass('red-text').text("Error: " + err.message);
    });
  } else {
    firebase.auth().signInWithPopup(new provider()).catch(err => {
      $(".loginForm > h6").addClass('red-text').text("Error: " + err.message);
    });
  }
}

$(".loginGoogle").click((e)=>{
  e.preventDefault();
  oAuthLogin(firebase.auth.GoogleAuthProvider);
});

$(".loginGithub").click((e)=>{
  e.preventDefault();
  oAuthLogin(firebase.auth.GithubAuthProvider);
});

$(".loginAnon").click((e)=>{
  e.preventDefault();
  const user = firebase.auth().currentUser;
  if(user && !user.isAnonymous) return $(".loginForm > h6").addClass('red-text').text("Error: You are already logged in, please refresh the page.");
  else if(user && user.isAnonymous) return finishLogin(user);
  firebase.auth().signInAnonymously().catch(err => {
    $(".loginForm > h6").addClass('red-text').text("Error: " + err.message);
  });
});

firebase.auth().onAuthStateChanged(user => {
  if(!user) return showLogin();
  finishLogin(user);

});



AFRAME.registerComponent('multiplayer-firebase', {
  schema: {
    joinedRoom: {type: 'string'}
  },
  init: function(){
    this.socket = null;
    this.msystem = document.querySelector('a-scene').systems['multiplayer'];
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
        this.msystem.removeStoke(event);
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
        this.msystem.userMove(event);
      });

      this.socket.on('userLeave', event => {
        if(event.owner === self.socket.owner) return;
        this.msystem.userLeave(event);
      });

      this.msystem.onNewStroke = event => this.socket.emit('newStroke', event);
      this.msystem.onRemoveStroke = event => this.socket.emit('removeStroke', event);
      this.msystem.onNewPoints = event => this.socket.emit('newPoints', event);
      this.msystem.onUserMove = event => this.socket.emit('userMove', event);
      this.msystem.onUserLeave = () => this.socket.emit('userLeave');
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
