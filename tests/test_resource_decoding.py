import sys
import struct
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from decode_map_assets import decode_lz4_stream, chunks


def frame(payload, final=True):
    return len(payload).to_bytes(3,'little')+bytes([128 if final else 0])+payload


class ResourceDecodingTests(unittest.TestCase):
    def test_literals(self):
        self.assertEqual(decode_lz4_stream(frame(b'\x50hello'),5),b'hello')

    def test_overlapping_match(self):
        # Three literals followed by a 9-byte match at distance 3.
        self.assertEqual(decode_lz4_stream(frame(b'\x35ABC\x03\x00'),12),b'ABCABCABCABC')

    def test_dictionary_crosses_chunk_boundary(self):
        payload=frame(b'\x40ABCD',False)+frame(b'\x00\x04\x00')
        self.assertEqual(decode_lz4_stream(payload,8),b'ABCDABCD')

    def test_rejects_bad_output_size(self):
        with self.assertRaises(ValueError): decode_lz4_stream(frame(b'\x50hello'),6)

    def test_rejects_truncated_chunk(self):
        with self.assertRaises(ValueError): decode_lz4_stream(frame(b'\x50hello')[:-1],5)

    def test_rejects_invalid_match(self):
        with self.assertRaises(ValueError): decode_lz4_stream(frame(b'\x00\x01\x00'),4)

    def test_terrain_chunks_and_length(self):
        data=b'TERRVERS'+struct.pack('>I',4)+struct.pack('<I',9)
        good=b'FORM'+struct.pack('>I',len(data))+data
        self.assertEqual(dict(chunks(good)),{'VERS':struct.pack('<I',9)})
        with self.assertRaises(ValueError): list(chunks(good[:-1]))


if __name__=='__main__': unittest.main()
