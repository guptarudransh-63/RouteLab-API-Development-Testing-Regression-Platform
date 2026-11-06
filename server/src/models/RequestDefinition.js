import mongoose from 'mongoose';

const keyValuePairSchema = new mongoose.Schema(
  {
    key: { type: String, default: '' },
    value: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    description: { type: String, default: '' },
  },
  { _id: false }
);

const testAssertionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, default: 'Assertion' },
    target: {
      type: String,
      enum: ['statusCode', 'responseTime', 'header', 'jsonPath', 'bodyText'],
      default: 'statusCode',
    },
    property: { type: String, default: '' }, // For header name or jsonPath (e.g. data.id)
    operator: {
      type: String,
      enum: [
        'equals',
        'notEquals',
        'lessThan',
        'greaterThan',
        'contains',
        'notContains',
        'exists',
        'notExists',
        'matchesRegex',
        'isType',
      ],
      default: 'equals',
    },
    expectedValue: { type: mongoose.Schema.Types.Mixed, default: '' },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const extractedVariableSchema = new mongoose.Schema(
  {
    varName: { type: String, required: true },
    source: { type: String, enum: ['body', 'header', 'statusCode'], default: 'body' },
    path: { type: String, default: '' }, // e.g. token or user.id
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const requestDefinitionSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    folderId: {
      type: String,
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Request name is required'],
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    method: {
      type: String,
      required: true,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      default: 'GET',
    },
    url: {
      type: String,
      required: [true, 'URL is required'],
      trim: true,
    },
    params: [keyValuePairSchema],
    headers: [keyValuePairSchema],
    auth: {
      type: {
        type: String,
        enum: ['none', 'bearer', 'basic', 'apikey'],
        default: 'none',
      },
      bearer: { token: { type: String, default: '' } },
      basic: {
        username: { type: String, default: '' },
        password: { type: String, default: '' },
      },
      apikey: {
        key: { type: String, default: '' },
        value: { type: String, default: '' },
        addTo: { type: String, enum: ['header', 'query'], default: 'header' },
      },
    },
    body: {
      type: {
        type: String,
        enum: ['none', 'json', 'raw', 'urlencoded'],
        default: 'none',
      },
      raw: { type: String, default: '' },
      urlencoded: [keyValuePairSchema],
    },
    tests: [testAssertionSchema],
    extractedVariables: [extractedVariableSchema],
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

requestDefinitionSchema.index({ collectionId: 1, order: 1 });
requestDefinitionSchema.index({ owner: 1, collectionId: 1 });

export const RequestDefinition = mongoose.model('RequestDefinition', requestDefinitionSchema);
