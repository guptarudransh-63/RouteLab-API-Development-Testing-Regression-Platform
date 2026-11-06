import { parseOpenApiSpec, convertOpenApiToRequests, compareOpenApiSpecs } from '../services/openapiService.js';
import { Collection } from '../models/Collection.js';
import { RequestDefinition } from '../models/RequestDefinition.js';
import { validateOutboundUrl } from '../services/ssrfShield.js';

export async function importOpenApi(req, res, next) {
  try {
    const { specContent, specUrl, collectionName } = req.body;

    let rawSpec = specContent;

    // If URL is provided, fetch with SSRF check
    if (specUrl) {
      await validateOutboundUrl(specUrl, process.env.ALLOW_LOCAL_REQUESTS === 'true');
      const fetched = await fetch(specUrl);
      if (!fetched.ok) {
        return res.status(400).json({ success: false, error: `Failed to fetch spec from URL: ${fetched.statusText}` });
      }
      rawSpec = await fetched.text();
    }

    if (!rawSpec) {
      return res.status(400).json({ success: false, error: 'OpenAPI specification content or URL is required' });
    }

    const parsedSpec = parseOpenApiSpec(rawSpec);
    const title = collectionName || parsedSpec.info?.title || 'OpenAPI Imported Collection';
    const description = parsedSpec.info?.description || 'Imported from OpenAPI specification';

    // 1. Create collection
    const collection = await Collection.create({
      owner: req.user._id,
      name: title,
      description,
      folders: [],
      variables: [
        {
          key: 'baseUrl',
          value: parsedSpec.servers?.[0]?.url || 'http://localhost:5001/api/v1/mock',
          isSecret: false,
        },
      ],
    });

    // 2. Generate requests
    const generatedRequests = convertOpenApiToRequests(parsedSpec);

    if (generatedRequests.length > 0) {
      const docsToInsert = generatedRequests.map((r, idx) => ({
        ...r,
        owner: req.user._id,
        collectionId: collection._id,
        order: idx,
      }));
      await RequestDefinition.insertMany(docsToInsert);
    }

    res.status(201).json({
      success: true,
      message: `Successfully imported OpenAPI spec with ${generatedRequests.length} endpoints`,
      collection,
      endpointCount: generatedRequests.length,
    });
  } catch (err) {
    next(err);
  }
}

export async function compareOpenApi(req, res, next) {
  try {
    const { oldSpecContent, newSpecContent } = req.body;

    if (!oldSpecContent || !newSpecContent) {
      return res.status(400).json({
        success: false,
        error: 'Both oldSpecContent and newSpecContent are required for comparison',
      });
    }

    const oldSpec = parseOpenApiSpec(oldSpecContent);
    const newSpec = parseOpenApiSpec(newSpecContent);

    const diff = compareOpenApiSpecs(oldSpec, newSpec);

    res.status(200).json({
      success: true,
      diff,
    });
  } catch (err) {
    next(err);
  }
}
