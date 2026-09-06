from pathlib import Path
import struct
import sys
import unittest
import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from decode_topography import decode_roads, SOURCE
from verify_map_registration import nearest_segment


def sample_topo():
    # A two-metre-wide road quad in screen coordinates.
    vertices=struct.pack('<8f',10,20,12,20,12,30,10,30)
    record=bytes([1])+struct.pack('<I',4)+vertices+struct.pack('<I',0)
    payload=struct.pack('<8I',0,1,0,0,0,0,0,0)+struct.pack('<2I',1,1)+record
    end=40+len(payload)
    road=b'ROAD'+struct.pack('<4I',2,len(payload),end,0)+payload
    return b'TOPO'+struct.pack('<4I',1,end-20,end,0)+road+b'_EOF'


class TopographyTests(unittest.TestCase):
    def test_quad_transform_and_centre(self):
        decoded=decode_roads(sample_topo(),map_height=100)
        self.assertEqual(decoded['roads'][0]['quads'][0],[[10,80],[12,80],[12,70],[10,70]])
        self.assertEqual(decoded['roads'][0]['segments'][0],[[11,80],[11,70]])

    def test_bad_envelope(self):
        with self.assertRaises(ValueError):decode_roads(sample_topo()[:-1])

    def test_bad_histogram(self):
        bad=bytearray(sample_topo());struct.pack_into('<I',bad,44,2)
        with self.assertRaises(ValueError):decode_roads(bad)

    def test_bad_vertex_count(self):
        bad=bytearray(sample_topo());struct.pack_into('<I',bad,81,3)
        with self.assertRaises(ValueError):decode_roads(bad)

    def test_unknown_tail(self):
        bad=bytearray(sample_topo());struct.pack_into('<I',bad,len(bad)-8,1)
        with self.assertRaises(ValueError):decode_roads(bad)

    def test_nonfinite_coordinates(self):
        bad=bytearray(sample_topo());struct.pack_into('<f',bad,85,float('nan'))
        with self.assertRaises(ValueError):decode_roads(bad)

    def test_distance_clamps_to_segment(self):
        segment=np.array([[[0.,0.],[10.,0.]]])
        self.assertEqual(nearest_segment([[5,3],[13,4]],segment),[3,5])

    def test_supplied_archive_has_six_consistent_lods(self):
        data=decode_roads(SOURCE.read_bytes())
        self.assertEqual(len(data['roads']),342)
        self.assertEqual(len(data['lods']),6)
        self.assertEqual(sum(len(r['quads']) for r in data['roads']),9426)


if __name__=='__main__':unittest.main()
