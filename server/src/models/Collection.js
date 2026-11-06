import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    parentId: { type: String, default: null },
  },
  { _id: false }
);

const variableSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    value: { type: String, default: '' },
    isSecret: { type: Boolean, default: false },
  },
  { _id: false }
);

const collectionSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Collection name is required'],
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    folders: [folderSchema],
    variables: [variableSchema],
  },
  {
    timestamps: true,
  }
);

collectionSchema.index({ owner: 1, name: 1 });

export const Collection = mongoose.model('Collection', collectionSchema);
