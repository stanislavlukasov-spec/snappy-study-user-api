// Very simple in-memory store shared across handlers (for local testing only).
// In production you will replace this with real DB access using the
// DB_* environment variables provisioned by CloudFormation.

const parents = new Map(); // parentId -> { id, children: Child[] }

function getOrCreateParent(parentId) {
  let parent = parents.get(parentId);
  if (!parent) {
    parent = { id: parentId, children: [] };
    parents.set(parentId, parent);
  }
  return parent;
}

function findParent(parentId) {
  return parents.get(parentId) || null;
}

function addChild(parentId, child) {
  const parent = getOrCreateParent(parentId);
  parent.children.push(child);
  parents.set(parentId, parent);
  return child;
}

function findChild(parentId, childId) {
  const parent = findParent(parentId);
  if (!parent) return null;
  return parent.children.find((c) => c.id === childId) || null;
}

module.exports = {
  parents,
  getOrCreateParent,
  findParent,
  addChild,
  findChild,
};
