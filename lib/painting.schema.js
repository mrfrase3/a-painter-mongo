const {Schema} = require('mongoose');

const vec3 = {
    type: [Number],
    validate: {
        validator: function(v) {
            return v.length === 3;
        },
        message: 'invalid vector provided for {PATH}, must be 3 long.'
    },
};

const vec4 = {
    type: [Number],
    validate: {
        validator: function(v) {
            return v.length === 4;
        },
        message: 'invalid vector provided for {PATH}, must be 4 long.'
    },
};

const PointSchema = new Schema({
    position: vec3,
    orientation: vec4,
    pointerPosition: vec3,
    pressure: Number,
    timestamp: Number
});

const StrokeSchema = new Schema({
    points: [PointSchema],
    owner: {type: Schema.Types.ObjectId, index: true},
    timestamp: {type: Number, index: true},
    brush: {
        color: vec3,
        brushName: String,
        size: Number
    }
});

class Stroke {

    //==-- Methods --==//
    addPoints(points){
        if(!Array.isArray(points)) points = [points];
        for(let i in points){
            this.points.push(points[i]);
        }
        return this.save();
    }
}

StrokeSchema.loadClass(Stroke);

StrokeSchema.statics.findStroke = function(owner, timestamp, cb) {
    return this.findOne({ owner, timestamp }, cb);
};

StrokeSchema.statics.removeStroke = function(owner, timestamp, cb) {
    return this.remove({ owner, timestamp }, cb);
};

module.exports = StrokeSchema;