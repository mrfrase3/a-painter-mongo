const fs = require('fs');
const config = require('./config.json');

const express = require('express');
const session = require("express-session");
const MongoStore = require('connect-mongo')(session);
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const helmet = require("helmet");

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const GitHubStrategy = require('passport-github').Strategy;

const painter_dir = __dirname + '/a-painter';
const clients = [];
const rooms = {};

const token = function() {
    return Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
};

passport.use(new GoogleStrategy({
        clientID: config.auth.google.clientID,
        clientSecret: config.auth.google.clientSecret,
        callbackURL: config.auth.google.callbackURL
    },
    function(accessToken, refreshToken, profile, done) {
        Users.findOrCreateUsingGoogle(profile, done);
    }
));

passport.use(new GoogleStrategy({
        clientID: config.auth.github.clientID,
        clientSecret: config.auth.github.clientSecret,
        callbackURL: config.auth.github.callbackURL
    },
    function(accessToken, refreshToken, profile, done) {
        Users.findOrCreateUsingGitHub(profile, done);
    }
));

const mongoStore = new MongoStore({
    mongooseConnection: mongoose.connection, //reuse the existing mongoose connection
    touchAfter: 24 * 3600 //sec
});

app.use(session({
    secret: config.sessionSecret,
    saveUninitialized: false, // dont save empty sessions
    resave: false, //don't save unchanged sessions
    store: mongoStore
}));
app.use(helmet());

app.use('/assets', express.static(painter_dir + '/assets'));
app.use('/css', express.static(painter_dir + '/css'));
app.use('/img', express.static(painter_dir + '/img'));
app.use('/src', express.static(painter_dir + '/src'));
app.use('/vendor', express.static(painter_dir + '/vendor'));
app.use('/brushes', express.static(painter_dir + '/brushes'));
app.use('/paintings', express.static(painter_dir + '/paintings'));

app.use('/client', express.static(__dirname + '/client'));
app.use('/', express.static(__dirname + '/dist'));

app.use(passport.initialize());
app.use(passport.session());

//app.use(webpackDevMiddleware(compiler, {
//    publicPath: webpackConfig.output.publicPath
//}));

app.get('/', function(req, res){
    fs.readFile(painter_dir + '/index.html', (err, data) => {
        if (err) throw err;
        res.send(data +
            '<script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.0.3/socket.io.js"></script>' +
            '<script src="client/socket.js"></script>' +
            '<script src="client/remote-user.js"></script>'
        );
    });
});

app.get('/auth/anon', function(req, res, next){
    if(req.user) return res.redirect('/');
    Users.createAnonUser(user=>{
        req.login(user, err=>{
            if(err) return next(err);
            return res.redirect('/');
        })
    });
});

app.get('/auth/google', passport.authenticate('google', { scope: [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login'}), (req, res)=>res.redirect('/'));
app.get('/auth/github', passport.authenticate('github'), { scope: [
    'read:user',
    'user:email'
] });
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login'}), (req, res)=>res.redirect('/'));

app.get('/logout', function(req, res){
    req.logout();
    res.redirect('/login');
});

io.on('connect', function(socket){
    socket.owner = token();
    while(clients.indexOf(socket.owner) !== -1) socket.owner = token();
    clients.push(socket.owner);

    socket.on('joinRoom', function(room){
        socket.joinedRoom = room;
        socket.join(room);
        if(!roomlog[room]) roomlog[room] = {};
        socket.emit('joinedRoom', roomlog[room]);
    });

    socket.on('newStroke', function(event){
        if(!socket.joinedRoom) return;
        event.stroke.owner = socket.owner;
        socket.broadcast.to(socket.joinedRoom).emit('newStroke', event);
        let rl_index = event.stroke.owner + "-" + event.stroke.timestamp;
        event.points = [];
        roomlog[socket.joinedRoom][rl_index] = event;
    });

    socket.on('removeStroke', function(event){
        if(!socket.joinedRoom) return;
        event.stroke.owner = socket.owner;
        socket.broadcast.to(socket.joinedRoom).emit('removeStroke', event);
        let rl_index = event.stroke.owner + "-" + event.stroke.timestamp;
        delete roomlog[socket.joinedRoom][rl_index];
    });

    socket.on('newPoints', function(event){
        if(!socket.joinedRoom) return;
        for(let i in event) event[i].stroke.owner = socket.owner;
        socket.broadcast.to(socket.joinedRoom).emit('newPoints', event);
        for(let i in event){
            let rl_index = event[i].stroke.owner + "-" + event[i].stroke.timestamp;
            if(!roomlog[socket.joinedRoom][rl_index]) continue;
            roomlog[socket.joinedRoom][rl_index].points.push.apply(roomlog[socket.joinedRoom][rl_index].points, event[i].points);
        }
    });

    socket.on('userMove', function(event){
        if(!socket.joinedRoom) return;
        event.owner = socket.owner;
        socket.broadcast.to(socket.joinedRoom).emit('userMove', event);
    });

    socket.on('userLeave', function(){
        if(!socket.joinedRoom) return;
        socket.broadcast.to(socket.joinedRoom).emit('userLeave', {owner: socket.owner});
    });

    socket.on('disconnect', function(){
        if(!socket.joinedRoom) return;
        socket.broadcast.to(socket.joinedRoom).emit('userLeave', {owner: socket.owner});
    });

    socket.emit('giveOwner', socket.owner);
});

server.listen(3002);
console.log('Server running on port 3002');