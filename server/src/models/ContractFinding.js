import mongoose from 'mongoose';

const contractFindingSchema = new mongoose.Schema(
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
    snapshotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContractSnapshot',
      required: true,
      index: true,
    },
    baselineSnapshotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContractSnapshot',
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['breaking', 'potentially_breaking', 'non_breaking', 'behavioral_regression', 'performance_regression'],
      required: true,
      index: true,
    },
    changeType: {
      type: String,
      required: true,
    },
    jsonPath: {
      type: String,
      required: true,
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    explanation: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['open', 'suppressed', 'resolved'],
      default: 'open',
    },
    suppressionReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

contractFindingSchema.index({ requestId: 1, severity: 1 });

export const ContractFinding = mongoose.model('ContractFinding', contractFindingSchema);
