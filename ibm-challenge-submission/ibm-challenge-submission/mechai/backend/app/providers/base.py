"""Abstract base class and shared data types for repair data providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class TSBRecord:
    """A single Technical Service Bulletin (or complaint proxy) entry.

    Attributes:
        tsb_number: Manufacturer or regulatory TSB identifier, if available.
        title: Short human-readable title for the bulletin.
        symptom_tags: List of snake_case tags describing the symptoms addressed.
        diagnosis: Free-form diagnostic description.
        repair_procedure: Recommended repair procedure text.
        labor_hours: Estimated labour time in hours, or ``None`` if unknown.
        source_url: Canonical URL to the original bulletin, if available.
        provider_source: Identifier string for the originating provider
            (e.g. ``"nhtsa_complaints"``, ``"imported"``, ``"generic_api"``).
    """

    tsb_number: str | None
    title: str
    symptom_tags: list[str]
    diagnosis: str
    repair_procedure: str
    labor_hours: float | None
    source_url: str | None
    provider_source: str


@dataclass
class CommunityThread:
    """A community forum thread or discussion post related to a repair topic.

    Attributes:
        title: Thread headline.
        symptom_tags: List of snake_case tags extracted from the thread.
        summary: Short plain-language summary of the thread content.
        resolution: Accepted fix or resolution text, if available.
        source_url: Canonical URL to the original thread, if available.
        provider_source: Identifier string for the originating provider.
    """

    title: str
    symptom_tags: list[str]
    summary: str
    resolution: str | None
    source_url: str | None
    provider_source: str


class RepairDataProvider(ABC):
    """Abstract interface that all repair-data backends must implement.

    Concrete providers (``NHTSAProvider``, ``ImportedDataProvider``,
    ``GenericAPIProvider``) implement this interface so that the diagnosis
    engine can query any backend through a uniform API.
    """

    @abstractmethod
    def search_tsbs(
        self, make: str, model: str, year: int, symptom_tags: list[str]
    ) -> list[TSBRecord]:
        """Return TSB records relevant to the given vehicle and symptom tags.

        Args:
            make: Vehicle manufacturer (e.g. ``"Toyota"``).
            model: Vehicle model (e.g. ``"Camry"``).
            year: Model year (e.g. ``2018``).
            symptom_tags: List of snake_case symptom tags to match against.

        Returns:
            A (possibly empty) list of ``TSBRecord`` objects.
        """
        ...

    @abstractmethod
    def search_community_threads(
        self, make: str, model: str, year: int, symptom_tags: list[str]
    ) -> list[CommunityThread]:
        """Return community threads relevant to the given vehicle and symptom tags.

        Args:
            make: Vehicle manufacturer.
            model: Vehicle model.
            year: Model year.
            symptom_tags: List of snake_case symptom tags to match against.

        Returns:
            A (possibly empty) list of ``CommunityThread`` objects.
        """
        ...

    @abstractmethod
    def get_labor_hours(self, tsb_id: str) -> float | None:
        """Look up estimated labour hours for a given TSB identifier.

        Args:
            tsb_id: The TSB number or internal record identifier.

        Returns:
            Estimated hours as a float, or ``None`` if unavailable.
        """
        ...
