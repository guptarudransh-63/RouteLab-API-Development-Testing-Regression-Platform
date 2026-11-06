import { Collection } from '../models/Collection.js';
import { RequestDefinition } from '../models/RequestDefinition.js';
import crypto from 'node:crypto';

export async function getCollections(req, res, next) {
  try {
    const collections = await Collection.find({ owner: req.user._id }).sort({ updatedAt: -1 });

    // Attach request counts
    const counts = await RequestDefinition.aggregate([
      { $match: { owner: req.user._id } },
      { $group: { _id: '$collectionId', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    for (const c of counts) {
      countMap[String(c._id)] = c.count;
    }

    const result = collections.map((col) => ({
      ...col.toObject(),
      requestCount: countMap[String(col._id)] || 0,
    }));

    res.status(200).json({ success: true, collections: result });
  } catch (err) {
    next(err);
  }
}

export async function createCollection(req, res, next) {
  try {
    const { name, description, folders, variables } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Collection name is required' });
    }

    const collection = await Collection.create({
      owner: req.user._id,
      name,
      description: description || '',
      folders: folders || [],
      variables: variables || [],
    });

    res.status(201).json({ success: true, collection });
  } catch (err) {
    next(err);
  }
}

export async function getCollectionById(req, res, next) {
  try {
    const collection = await Collection.findOne({ _id: req.params.id, owner: req.user._id });
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' });
    }

    const requests = await RequestDefinition.find({
      collectionId: collection._id,
      owner: req.user._id,
    }).sort({ order: 1, createdAt: 1 });

    res.status(200).json({ success: true, collection, requests });
  } catch (err) {
    next(err);
  }
}

export async function updateCollection(req, res, next) {
  try {
    const { name, description, folders, variables } = req.body;
    const collection = await Collection.findOne({ _id: req.params.id, owner: req.user._id });

    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' });
    }

    if (name) collection.name = name;
    if (description !== undefined) collection.description = description;
    if (folders) collection.folders = folders;
    if (variables) collection.variables = variables;

    await collection.save();
    res.status(200).json({ success: true, collection });
  } catch (err) {
    next(err);
  }
}

export async function deleteCollection(req, res, next) {
  try {
    const collection = await Collection.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' });
    }

    // Cascade delete requests belonging to this collection
    await RequestDefinition.deleteMany({ collectionId: collection._id, owner: req.user._id });

    res.status(200).json({ success: true, message: 'Collection and associated requests deleted' });
  } catch (err) {
    next(err);
  }
}

/**
 * Export collection with all its requests
 */
export async function exportCollection(req, res, next) {
  try {
    const collection = await Collection.findOne({ _id: req.params.id, owner: req.user._id });
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' });
    }

    const requests = await RequestDefinition.find({
      collectionId: collection._id,
      owner: req.user._id,
    }).sort({ order: 1 });

    // Mask secrets on export
    const safeVariables = collection.variables.map((v) => ({
      key: v.key,
      value: v.isSecret ? '' : v.value,
      isSecret: v.isSecret,
    }));

    const exportData = {
      routelab_schema: '1.0.0',
      exportedAt: new Date().toISOString(),
      collection: {
        name: collection.name,
        description: collection.description,
        folders: collection.folders,
        variables: safeVariables,
      },
      requests: requests.map((r) => ({
        name: r.name,
        description: r.description,
        folderId: r.folderId,
        method: r.method,
        url: r.url,
        params: r.params,
        headers: r.headers,
        auth: r.auth,
        body: r.body,
        tests: r.tests,
        extractedVariables: r.extractedVariables,
        order: r.order,
      })),
    };

    res.setHeader('Content-Disposition', `attachment; filename="${collection.name.replace(/\s+/g, '_')}.routelab.json"`);
    res.status(200).json(exportData);
  } catch (err) {
    next(err);
  }
}

/**
 * Import collection from Postman v2.1 or RouteLab JSON
 */
export async function importCollection(req, res, next) {
  try {
    const importPayload = req.body;
    if (!importPayload) {
      return res.status(400).json({ success: false, error: 'Import payload is required' });
    }

    // Check if Postman v2.1 format
    if (importPayload.info && importPayload.item) {
      const colName = importPayload.info.name || 'Imported Postman Collection';
      const colDesc = importPayload.info.description || '';

      const collection = await Collection.create({
        owner: req.user._id,
        name: colName,
        description: colDesc,
        folders: [],
        variables: (importPayload.variable || []).map((v) => ({
          key: v.key,
          value: v.value || '',
          isSecret: false,
        })),
      });

      // Parse Postman items recursively
      const parsedRequests = [];
      function parseItems(items, folderId = null) {
        for (const it of items) {
          if (it.request) {
            // It's a request
            let url = '';
            if (typeof it.request.url === 'string') {
              url = it.request.url;
            } else if (it.request.url?.raw) {
              url = it.request.url.raw;
            }

            const method = (it.request.method || 'GET').toUpperCase();
            const headers = (it.request.header || []).map((h) => ({
              key: h.key,
              value: h.value,
              enabled: !h.disabled,
            }));

            let bodyType = 'none';
            let rawBody = '';
            if (it.request.body) {
              if (it.request.body.mode === 'raw') {
                bodyType = 'json';
                rawBody = it.request.body.raw;
              }
            }

            parsedRequests.push({
              owner: req.user._id,
              collectionId: collection._id,
              folderId,
              name: it.name || 'Imported Request',
              method,
              url: url || '{{baseUrl}}',
              headers,
              body: { type: bodyType, raw: rawBody },
              tests: [
                {
                  id: `t_${crypto.randomUUID().substring(0, 8)}`,
                  name: 'Status is 200',
                  target: 'statusCode',
                  operator: 'equals',
                  expectedValue: '200',
                  enabled: true,
                },
              ],
            });
          } else if (it.item) {
            // It's a folder
            const fid = `f_${crypto.randomUUID().substring(0, 8)}`;
            collection.folders.push({ id: fid, name: it.name, parentId: folderId });
            parseItems(it.item, fid);
          }
        }
      }

      parseItems(importPayload.item);
      await collection.save();

      if (parsedRequests.length > 0) {
        await RequestDefinition.insertMany(parsedRequests);
      }

      return res.status(201).json({
        success: true,
        message: `Imported ${parsedRequests.length} requests from Postman collection`,
        collection,
      });
    }

    // RouteLab native import
    if (importPayload.collection) {
      const colData = importPayload.collection;
      const collection = await Collection.create({
        owner: req.user._id,
        name: colData.name || 'Imported Collection',
        description: colData.description || '',
        folders: colData.folders || [],
        variables: colData.variables || [],
      });

      if (Array.isArray(importPayload.requests)) {
        const reqs = importPayload.requests.map((r, idx) => ({
          ...r,
          owner: req.user._id,
          collectionId: collection._id,
          order: idx,
        }));
        await RequestDefinition.insertMany(reqs);
      }

      return res.status(201).json({
        success: true,
        message: 'Imported RouteLab collection successfully',
        collection,
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Unrecognized format. Expected Postman Collection v2.1 or RouteLab Collection format.',
    });
  } catch (err) {
    next(err);
  }
}
