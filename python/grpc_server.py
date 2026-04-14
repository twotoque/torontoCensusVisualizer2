# grpc_server.py 
import grpc
import threading
from concurrent import futures
import figures_pb2, figures_pb2_grpc

from fastapi.testclient import TestClient
from api import app

from api import (
    get_years, search, get_map, get_bar, get_stack,
    get_export, export_stack, semantic, semantic_global,
    ask, predict_neighbourhoods, predict, predict_compare,
    get_cell, get_median, compare_years
)

_local = threading.local()

def _get_client():
    if not hasattr(_local, "client"):
        _local.client = TestClient(app)
    return _local.client


class FiguresServicer(figures_pb2_grpc.FiguresServicer):

    def Get(self, request, context):
        resp = _get_client().get(request.path)
        return figures_pb2.GetResponse(
            body=resp.content,
            status=resp.status_code,
        )

    def Post(self, request, context):
        resp = _get_client().post(
            request.path,
            content=request.body,
            headers={"Content-Type": "application/json"},
        )
        return figures_pb2.PostResponse(
            body=resp.content,
            status=resp.status_code,
        )

    def Stream(self, request, context):
        if request.method == "POST":
            resp = _get_client().post(request.path, content=request.body, headers={"Content-Type": "application/json"})
        else:
            resp = _get_client().get(request.path)

        chunk_size = 64 * 1024
        for i in range(0, len(resp.content), chunk_size):
            yield figures_pb2.Chunk(data=resp.content[i:i + chunk_size])


if __name__ == "__main__":
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    figures_pb2_grpc.add_FiguresServicer_to_server(FiguresServicer(), server)
    server.add_insecure_port("[::]:50051")
    server.start()
    server.wait_for_termination()