const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
  },
  { timestamps: true }
);

userSchema.methods.toJSON = function () {
  const data = this.toObject();
  delete data.passwordHash;
  return data;
};

module.exports = mongoose.model('User', userSchema);
