'use strict';

const express = require('express');
const { asyncRoute, HttpError } = require('../lib/http-error');
const drive = require('../lib/google-drive');

const router = express.Router();

router.get('/status', asyncRoute(async (_req, res) => {
  res.json(await drive.getStatus());
}));

router.get('/items', asyncRoute(async (req, res) => {
  const pageToken = String(req.query.pageToken || '').trim();
  if (pageToken.length > 2048) {
    throw new HttpError(422, 'Token de paginacao invalido.', 'INVALID_PAGE_TOKEN');
  }

  const result = await drive.listFolder({
    folderId: req.query.folderId,
    q: req.query.q,
    pageToken: pageToken || undefined,
    pageSize: req.query.limit
  });
  res.json(result);
}));

module.exports = router;
