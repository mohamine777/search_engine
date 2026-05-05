from indexing.inverted_index import InvertedIndex
from models.vsm_model import VectorSpaceModel
from models.bir_model import BIRModel
from utils.evaluation import Evaluator


class AppState:
    """In-memory singleton state for index and retrieval models."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.index = InvertedIndex()
            cls._instance.vsm = VectorSpaceModel(cls._instance.index)
            cls._instance.bir = BIRModel(cls._instance.index)
            cls._instance.evaluator = Evaluator()
        return cls._instance


state = AppState()
