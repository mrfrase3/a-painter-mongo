const paintingSchema = require('./painting.schema.js');
const roomSchema = require('./room.schema.js');

const perms: {none: 0, read: 1, write: 2, owner: 3};

class Rooms{
    constructor(mongoose, onlineClients){
        this.rooms = {};
        this.mongoose = mongoose;
        this.onlineClients = [];
        this.model = mongoose.model('room', roomSchema);
    }

    loadRoom(tag, ownerIfNew){
        return new Promise((resolve, reject)=>{
            if(this.rooms[tag]) return resolve(this.rooms[tag]);
            this.model.findByTag(tag).catch(reject).then(roomDoc=>{
                if(roomDoc){
                    this.rooms[tag] = {
                        doc: roomDoc,
                        active: [],
                        tag,
                        strokes: mongoose.model('painting-'+tag, paintingSchema);
                    }
                    return resolve(this.rooms[tag]);
                }
                return reject(new Error(`Room ${tag} does not exist.`));
            });
        });
    }

    unloadEmptyRoom(tag){
        if(!tag) {
            for(let i in this.rooms) this.unloadEmptyRoom(i);
            return;
        }
        if(this.rooms[tag].active.length < 1){
            delete this.mongoose.connection.models['painting-'+tag];
            delete this.rooms[tag];
        }
    }

    createRoom(name, uid, opts){
        if(!opts) opts = {};
        return new Promise((resolve, reject)=>{
            this._genTag().catch(reject).then(tag=>{
                this.model.create({
                    tag,
                    name,
                    public: perms[otps.public],
                    listed: opts.listed,
                    _collaborators: [{uid, perm: perms['owner']}]
                }).catch(reject).then(resolve);
            });
        });
    }

    joinRoom(tag, uid){
        return new Promise((resolve, reject)=>{
            this.loadRoom(tag).catch(reject).then((room)=>{
                if(!room.doc.can(uid, 'read')) return reject(new Error(`You do not have permission to join the room ${tag}`));
                if(!room.doc.hasCollab(uid)) room.doc.setCollab(uid);
                if(room.active.indexOf(uid) === -1) room.active.push(uid);
                resolve(room);
            });
        });
    }

    leaveRoom(uid){
        for(let i in this.rooms){
            let room = this.rooms[i];
            if(room.active.indexOf(uid) !== -1){
                room.active.splice(room.active.indexOf(uid), 1);
                this.unloadEmptyRoom(i);
            }
        }
    }

    _genTag(){
        return new Promise((resolve, reject)=>{
            let tag = Math.random().toString(36).substr(2);
            this.model.findByTag(tag).catch(reject).then(roomDoc=>{
                if(!roomDoc) return resolve(tag);
                this._genTag().catch(reject).then(resolve);
            });
        });
    }
}


module.exports = Rooms;



