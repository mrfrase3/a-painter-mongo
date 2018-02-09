const {Schema} = require('mongoose');

const emailSchema = new Schema({
    address: {
        type: String,
        required: true,
        match: [/^.+@.+[.].+$/, 'Invalid email provided.'],
        trim: true,
        lowercase: true
    },
    verified: {type: Boolean, default: false}
});

const name = {
    type: String,
    match: [/^[\s]*.{2,}[\s]*$/, 'Invalid name provided, must be 2 or more non-space charaters.'],
    required: [true, 'A name is required.'],
    trim: true,
    lowercase: true
};

const UserSchema = new Schema({
    username: {
        type: String,
        match: [/^[\s]*[\S]{3,}[\s]*$/, 'Invalid user name provided, must be 3 or more non-space characters.'],
        required: [true, 'A user name is required.'],
        trim: true,
        index: true,
        unique: true
    },
    emails: [emailSchema],
    profile: {
        firstName: name,
        lastName: name,
        picture: String,
        isGuest: {type: Boolean, default: false}
    },
    services: {
        github: {
            id: String
        },
        google: {
            id: String
        },
        expire: Number
    }

}, {timestamps: {}});

class User {

    //==-- Virtuals --==//

    get fullName() {
        return this.profile.firstName + ' ' + this.profile.lastName;
    }
}

UserSchema.loadClass(User);

//==-- Statics --==//

UserSchema.statics.findByUsername = function(name, cb) {
    return this.findOne({ username: new RegExp(name, 'i') }, cb);
};

UserSchema.statics.findOrCreateUsingGoogle = function(profile, cb) {
    this.findOne({ 'services.google.id': profile.id }, (user, err)=>{
        if(err) return cb( err);
        if(user) return cb(null, user);
        let emails = [];
        for(let i in profile.emails) emails.push({address: profile.emails[i].value, verified: true});
        this.create({
            username: '~~temp_username~~' + Math.random().toString(36).substr(2),
            emails,
            profile: {
                firstName: profile.given_name || profile.givenName || "Jo",
                lastName: profile.family_name || profile.familyName || "Smith",
                picture: profile.picture || ""
            },
            services: {
                google: {
                    id: profile.id
                }
            }
        }, cb);
    });
};

UserSchema.statics.findOrCreateUsingGitHub = function(profile, cb) {
    this.findOne({ 'services.github.id': profile.id }, (user, err)=>{
        if(err) return cb( err);
        if(user) return cb(null, user);
        let emails = [];
        for(let i in profile.emails) emails.push({address: profile.emails[i].value, verified: true});
        this.create({
            username: '~~temp_username~~' + Math.random().toString(36).substr(2),
            emails,
            profile: {
                firstName: profile.given_name || profile.givenName || "Jo",
                lastName: profile.family_name || profile.familyName || "Smith",
                picture: profile.picture || ""
            },
            services: {
                github: {
                    id: profile.id
                }
            }
        }, cb);
    });
};

UserSchema.statics.createAnonUser = function(name, cb) {
    this.create({
        username: 'Unknown-' + Math.random().toString(36).substr(2),
        emails,
        profile: {
            firstName: "Anon",
            lastName: "User",
            picture: "",
            isGuest: true
        },
        services: {
            expire: Date.now() + 7*24*60*60*1000 // 7 days
        }
    }, cb);
};

UserSchema.statics.removeExpired = function(name, cb) {
    this.remove({'services.expire': {$lte: Date.now()}});
};

module.exports = UserSchema;