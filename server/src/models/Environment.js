import mongoose from 'mongoose';

const envVariableSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    value: { type: String, default: '' },
    isSecret: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const environmentSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Environment name is required'],
      trim: true,
      maxlength: 100,
    },
    variables: [envVariableSchema],
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

environmentSchema.index({ owner: 1, name: 1 });

export const Environment = mongoose.model('Environment', environmentSchema);
