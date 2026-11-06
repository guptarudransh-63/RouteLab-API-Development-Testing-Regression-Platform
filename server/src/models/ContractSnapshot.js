import mongoose from 'mongoose';

const contractSnapshotSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RequestDefinition',
      required: true,
      index: true,
    },
    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Collection',
      required: true,
      index: true,
    },
    isBaseline: {
      type: Boolean,
      default: false,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    statusCode: {
      type: Number,
      required: true,
    },
    headers: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    normalizedSchema: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    rawSample: {
      type: String,
      default: '',
    },
    responseTimeMs: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

contractSnapshotSchema.index({ requestId: 1, isBaseline: 1 });
contractSnapshotSchema.index({ requestId: 1, createdAt: -1 });

export const ContractSnapshot = mongoose.model('ContractSnapshot', contractSnapshotSchema);
