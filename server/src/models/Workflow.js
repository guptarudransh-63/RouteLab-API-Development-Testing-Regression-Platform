import mongoose from 'mongoose';

const workflowStepSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RequestDefinition',
      required: true,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
    stopOnFailure: {
      type: Boolean,
      default: true,
    },
    extract: [
      {
        varName: { type: String, required: true },
        source: { type: String, enum: ['body', 'header', 'statusCode'], default: 'body' },
        path: { type: String, default: '' },
      },
    ],
  },
  { _id: false }
);

const workflowSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Workflow name is required'],
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    steps: [workflowStepSchema],
  },
  {
    timestamps: true,
  }
);

workflowSchema.index({ owner: 1, name: 1 });

export const Workflow = mongoose.model('Workflow', workflowSchema);
