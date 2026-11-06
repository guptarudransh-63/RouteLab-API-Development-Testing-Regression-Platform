import mongoose from 'mongoose';

const testAssertionResultSchema = new mongoose.Schema(
  {
    assertionId: { type: String },
    name: { type: String, required: true },
    passed: { type: Boolean, required: true },
    target: { type: String },
    operator: { type: String },
    expected: { type: mongoose.Schema.Types.Mixed },
    actual: { type: mongoose.Schema.Types.Mixed },
    message: { type: String, default: '' },
  },
  { _id: false }
);

const requestExecutionResultSchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'RequestDefinition' },
    requestName: { type: String, required: true },
    method: { type: String, required: true },
    url: { type: String, required: true },
    statusCode: { type: Number },
    statusText: { type: String },
    durationMs: { type: Number, default: 0 },
    responseSize: { type: Number, default: 0 },
    assertions: [testAssertionResultSchema],
    passed: { type: Boolean, default: true },
    contractChangesCount: { type: Number, default: 0 },
    contractFindings: [
      {
        severity: String,
        changeType: String,
        jsonPath: String,
        explanation: String,
      },
    ],
    error: { type: String, default: null },
  },
  { _id: false }
);

const testRunSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Collection',
      index: true,
    },
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workflow',
      index: true,
    },
    environmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Environment',
    },
    environmentName: {
      type: String,
      default: 'No Environment',
    },
    runType: {
      type: String,
      enum: ['collection', 'workflow', 'single'],
      default: 'collection',
    },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed', 'aborted'],
      default: 'completed',
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: Date.now,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    totalRequests: { type: Number, default: 0 },
    passedRequests: { type: Number, default: 0 },
    failedRequests: { type: Number, default: 0 },
    totalAssertions: { type: Number, default: 0 },
    passedAssertions: { type: Number, default: 0 },
    failedAssertions: { type: Number, default: 0 },
    contractFindingsSummary: {
      breaking: { type: Number, default: 0 },
      potentiallyBreaking: { type: Number, default: 0 },
      nonBreaking: { type: Number, default: 0 },
    },
    results: [requestExecutionResultSchema],
  },
  {
    timestamps: true,
  }
);

testRunSchema.index({ owner: 1, collectionId: 1, createdAt: -1 });
testRunSchema.index({ owner: 1, createdAt: -1 });

export const TestRun = mongoose.model('TestRun', testRunSchema);
