const {Schema} = require('mongoose');

const perms: {none: 0, read: 1, write: 2, owner: 3};

const colabSchema = new Schema({
    uid: Schema.Types.ObjectId,
    perm: {
        type: Number,
        default: 0,
        max: perms.owner,
        min: perms.none
    }
});

const RoomSchema = new Schema({
    name: {
        type: String,
        match: [/^[\s]*.{2,}[\s]*$/, 'Invalid first name provided, must have 2 or more non-space charaters.'],
        required: [true, 'A proper name is required.'],
        trim: true,
        lowercase: true
    },
    tag: {
        type: String,
        default: Math.random().toString(36).substr(2),
        match: [/^[\s]*[\S]{3,}[\s]*$/, 'Invalid tag provided, must be 3 or more non-space characters.'],
        required: [true, 'A unique tag is required.'],
        trim: true,
        index: true,
        unique: true
    },
    public: {
        type: Number,
        default: 0,
        max: perms.write,
        min: perms.none
    },
    listed: {type: Boolean, default: false},
    version: {type: Number, default: 1},
    _collaborators: [colabSchema]
}, {timestamps: {}});

class Room {
    //==-- Methods --==//

    can(uid, perm){
        if(perms[perm] <= this.public) return true;
        for(let i in this._collaborators){
            if(this._collaborators[i].uid === uid){
                if(perms[perm] <= this._collaborators[i].perm){
                    return true;
                } else return false;
            }
        }
        return false;
    }

    setCollab(uid, perm){
        let create = true;
        for (let i in this._collaborators) {
            if (this._collaborators[i].uid === uid) {
                this._collaborators[i].perm = perms[perm];
                create = false;
                break;
            }
        }
        if (create) this._collaborators.push({
            uid,
            perm: perms[perm]
        });
        return this.save();
    }

    hasCollab(uid){
        for(let i in this._collaborators){
            if(this._collaborators[i].uid === uid){
                return this._collaborators[i].perm;
            }
        }
        return 0;
    }

    getCollabs(perm='read'){
        let arr = [];
        for(let i in this._collaborators){
            if(perms[perm] <= this._collaborators[i].perm){
                arr.push(this._collaborators[i].uid);
            }
        }
        return arr;
    }
}

RoomSchema.loadClass(Room);

//==-- Statics --==//

RoomSchema.statics.findByTag = function(tag, cb) {
    return this.findOne({tag: tag.toLowerCase()}, cb);
};

module.exports = RoomSchema;