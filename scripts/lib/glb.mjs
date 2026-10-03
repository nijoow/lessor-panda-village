import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  renameSync,
  rmSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
const JSON_CHUNK = 0x4e4f534a,
  BIN_CHUNK = 0x004e4942;
export function parseGlb(glb) {
  if (
    !Buffer.isBuffer(glb) ||
    glb.length < 20 ||
    glb.readUInt32LE(0) !== 0x46546c67 ||
    glb.readUInt32LE(4) !== 2 ||
    glb.readUInt32LE(8) !== glb.length
  )
    throw new Error("Invalid GLB 2.0 header/length");
  let json,
    bin = Buffer.alloc(0),
    binStart = 0,
    seenBin = false;
  for (let offset = 12; offset < glb.length; ) {
    if (offset + 8 > glb.length) throw new Error("Truncated GLB chunk header");
    const length = glb.readUInt32LE(offset),
      type = glb.readUInt32LE(offset + 4),
      start = offset + 8;
    if (length % 4 || start + length > glb.length)
      throw new Error("Invalid GLB chunk length/alignment");
    if (offset === 12 && type !== JSON_CHUNK)
      throw new Error("First GLB chunk must be JSON");
    if (type === JSON_CHUNK) {
      if (json) throw new Error("Duplicate GLB JSON chunk");
      json = JSON.parse(glb.subarray(start, start + length).toString());
    } else if (type === BIN_CHUNK) {
      if (seenBin) throw new Error("Duplicate GLB BIN chunk");
      seenBin = true;
      bin = glb.subarray(start, start + length);
      binStart = start;
    }
    offset = start + length;
  }
  if (!json || json.asset?.version !== "2.0")
    throw new Error("Invalid glTF asset version");
  const declared = json.buffers?.[0];
  if (
    declared &&
    !declared.uri &&
    (!Number.isInteger(declared.byteLength) ||
      declared.byteLength < 0 ||
      declared.byteLength > bin.length ||
      bin.length - declared.byteLength > 3)
  )
    throw new Error("Invalid embedded buffer length");
  return { glb, json, bin, binStart };
}
export const readGlb = (path) => parseGlb(readFileSync(path));
export function encodeGlb({ json, bin = Buffer.alloc(0) }) {
  const encoded = Buffer.from(JSON.stringify(json));
  const paddedJson = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 0x20);
  encoded.copy(paddedJson);
  const paddedBin = Buffer.alloc(Math.ceil(bin.length / 4) * 4);
  bin.copy(paddedBin);
  const header = Buffer.alloc(20),
    binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + paddedJson.length + paddedBin.length, 8);
  header.writeUInt32LE(paddedJson.length, 12);
  header.writeUInt32LE(JSON_CHUNK, 16);
  binHeader.writeUInt32LE(paddedBin.length, 0);
  binHeader.writeUInt32LE(BIN_CHUNK, 4);
  const result = Buffer.concat([header, paddedJson, binHeader, paddedBin]);
  parseGlb(result);
  return result;
}
export function writeFileAtomic(path, data) {
  const temporary = mkdtempSync(join(dirname(path), `.${basename(path)}-`));
  try {
    const staged = join(temporary, "validated");
    writeFileSync(staged, data);
    renameSync(staged, path);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
export const writeGlb = (path, document) =>
  writeFileAtomic(path, encodeGlb(document));
const bytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const counts = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};
export function accessorInfo({ json, bin }, index) {
  const accessor = json.accessors?.[index],
    view = json.bufferViews?.[accessor?.bufferView];
  if (
    !accessor ||
    !view ||
    accessor.sparse ||
    view.buffer !== 0 ||
    json.buffers?.[0]?.uri ||
    view.extensions?.EXT_meshopt_compression
  )
    throw new Error("Accessor must use a decoded, dense embedded buffer");
  const elementBytes = bytes[accessor.componentType],
    elementCount = counts[accessor.type];
  if (
    !elementBytes ||
    !elementCount ||
    (accessor.type.startsWith("MAT") && accessor.componentType !== 5126)
  )
    throw new Error("Unsupported accessor representation");
  const viewOffset = view.byteOffset ?? 0,
    relative = accessor.byteOffset ?? 0;
  const size = elementBytes * elementCount,
    stride = view.byteStride ?? size,
    offset = viewOffset + relative;
  if (
    ![viewOffset, relative, view.byteLength, accessor.count, stride].every(
      Number.isInteger,
    ) ||
    viewOffset < 0 ||
    relative < 0 ||
    accessor.count < 1 ||
    stride < size ||
    stride % elementBytes ||
    offset % elementBytes ||
    (view.byteStride !== undefined && stride > 252)
  )
    throw new Error("Invalid accessor count/offset/stride");
  const end = relative + (accessor.count - 1) * stride + size;
  const bufferLength = json.buffers[0].byteLength;
  if (
    end > view.byteLength ||
    viewOffset + view.byteLength > bufferLength ||
    bufferLength > bin.length
  )
    throw new Error("Accessor is outside its buffer view");
  return {
    accessor,
    data: new DataView(bin.buffer, bin.byteOffset, bin.byteLength),
    offset,
    stride,
    elementBytes,
    elementCount,
  };
}
export function readComponent(info, element, component) {
  if (
    element < 0 ||
    element >= info.accessor.count ||
    component < 0 ||
    component >= info.elementCount
  )
    throw new Error("Accessor index outside bounds");
  const offset =
    info.offset + element * info.stride + component * info.elementBytes;
  switch (info.accessor.componentType) {
    case 5120:
      return info.data.getInt8(offset);
    case 5121:
      return info.data.getUint8(offset);
    case 5122:
      return info.data.getInt16(offset, true);
    case 5123:
      return info.data.getUint16(offset, true);
    case 5125:
      return info.data.getUint32(offset, true);
    case 5126:
      return info.data.getFloat32(offset, true);
  }
}
/** Typed-array mutation is valid only for packed, non-normalized source data. */
export function packedAccessorRange(document, index) {
  const info = accessorInfo(document, index);
  if (
    info.stride !== info.elementBytes * info.elementCount ||
    info.accessor.normalized
  )
    throw new Error("Repair input must have packed, non-normalized accessors");
  return {
    offset: document.binStart + info.offset,
    count: info.accessor.count,
    componentType: info.accessor.componentType,
    n: info.elementCount,
  };
}
export function assertLegacySkin(document, primitive) {
  if (primitive.extensions?.KHR_draco_mesh_compression)
    throw new Error("Decode repair input before modifying it");
  const specifications = [
    ["POSITION", 5126, "VEC3"],
    ["JOINTS_0", 5121, "VEC4"],
    ["WEIGHTS_0", 5126, "VEC4"],
  ];
  let count;
  for (const [name, componentType, type] of specifications) {
    const info = accessorInfo(document, primitive.attributes[name]);
    packedAccessorRange(document, primitive.attributes[name]);
    if (
      info.accessor.componentType !== componentType ||
      info.accessor.type !== type
    )
      throw new Error(
        `${name}: expected uncompressed ${componentType}/${type} legacy source`,
      );
    if (count !== undefined && count !== info.accessor.count)
      throw new Error("Skin attribute counts differ");
    count = info.accessor.count;
    for (let i = 0; i < count; i++)
      for (let j = 0; j < info.elementCount; j++)
        if (!Number.isFinite(readComponent(info, i, j)))
          throw new Error(`${name}: non-finite component`);
  }
}

export function assertSkinWeights(
  document,
  primitive,
  jointCount,
  tolerance = 1e-3,
) {
  const weights = accessorInfo(document, primitive.attributes.WEIGHTS_0);
  const joints = accessorInfo(document, primitive.attributes.JOINTS_0);
  if (
    weights.elementCount !== 4 ||
    joints.elementCount !== 4 ||
    weights.accessor.count !== joints.accessor.count
  )
    throw new Error("Invalid skin attribute shape");
  const normalization = weights.accessor.normalized
    ? { 5121: 255, 5123: 65535 }[weights.accessor.componentType]
    : 1;
  if (!normalization) throw new Error("Unsupported weight normalization");
  for (let i = 0; i < weights.accessor.count; i++) {
    let sum = 0;
    for (let j = 0; j < 4; j++) {
      const weight = readComponent(weights, i, j) / normalization,
        joint = readComponent(joints, i, j);
      if (
        !Number.isFinite(weight) ||
        weight < 0 ||
        weight > 1 ||
        !Number.isInteger(joint) ||
        joint < 0 ||
        joint >= jointCount
      )
        throw new Error(`Invalid skin influence at vertex ${i}`);
      sum += weight;
    }
    if (Math.abs(sum - 1) > tolerance)
      throw new Error(`Invalid skin weight sum ${sum} at vertex ${i}`);
  }
}
