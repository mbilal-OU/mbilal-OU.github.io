#!/usr/bin/env python3
"""Keep the public portfolio aligned with the current research-software catalog.

The script is intentionally deterministic. It updates curated portfolio sections
and refreshes the static public-repository fallback from the GitHub public API.
The page still performs its existing client-side lookup, so the displayed count
is live for visitors while this fallback remains useful when that request fails.
"""

from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
GITHUB_USER = "mbilal-OU"

ARROW = '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-right" aria-hidden="true"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg>'
ARROW_LARGE = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-right" aria-hidden="true"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg>'


def repo_count() -> int | None:
    request = urllib.request.Request(
        f"https://api.github.com/users/{GITHUB_USER}",
        headers={"Accept": "application/vnd.github+json", "User-Agent": "portfolio-sync"},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.load(response)
        value = payload.get("public_repos")
        return int(value) if isinstance(value, int) else None
    except Exception as exc:  # keep the last known fallback if GitHub is unavailable
        print(f"warning: could not refresh public repository count: {exc}")
        return None


def selected_software() -> str:
    return f'''<section class="work-preview" id="work"><div class="work-preview-copy"><p class="section-kicker light">Selected software</p><h2>Research ideas,<br>made inspectable.</h2><p>Flagship projects spanning statistical genomics, phylogenomics, and evidence-aware microbial genome analysis.</p><a href="https://github.com/mbilal-OU" target="_blank" rel="noreferrer">View all work on GitHub {ARROW}</a></div><div class="featured-projects"><a href="https://github.com/mbilal-OU/PanGWASFlow" target="_blank" rel="noreferrer"><span class="project-number">01</span><div><h3>PanGWASFlow</h3><p>Population-structure-aware microbial GWAS with reproducible QC, likelihood-ratio association testing, Mash-MDS correction, and published-data validation.</p></div>{ARROW_LARGE}</a><a href="https://github.com/mbilal-OU/PanPhyloFlow" target="_blank" rel="noreferrer"><span class="project-number">02</span><div><h3>PanPhyloFlow</h3><p>Reproducible pangenome-to-phylogeny workflow with explicit thresholds, inspectable intermediate results, and publication-ready reporting.</p></div>{ARROW_LARGE}</a><a href="https://github.com/mbilal-OU/SpeciesResolve" target="_blank" rel="noreferrer"><span class="project-number">03</span><div><h3>SpeciesResolve</h3><p>Evidence-aware microbial species delineation across genome quality, ANI, taxonomy, dereplication, and phylogeny.</p></div>{ARROW_LARGE}</a></div></section>'''


def tile(number: str, css: str, repo: str, title: str, strong: str, text: str, tags: list[str]) -> str:
    tag_html = "".join(f"<span>{tag}</span>" for tag in tags)
    return (
        f'<a class="project-tile {css}" href="https://github.com/mbilal-OU/{repo}" target="_blank" rel="noreferrer">'
        f'<div class="project-tile-head"><span>{number}</span>{ARROW}</div>'
        f'<div><h3>{title}</h3><strong>{strong}</strong><p>{text}</p></div>'
        f'<div class="project-tags">{tag_html}</div></a>'
    )


def research_ecosystem() -> str:
    cards = [
        tile("01", "coral", "PanGenFlow", "PanGenFlow", "Turn an NCBI taxon query into a traceable genome cohort.", "Genome retrieval, GCA/GCF reconciliation, metadata capture, explicit quality filters, and optional close-genome relatedness checks.", ["NCBI Datasets", "CheckM2", "FastANI", "HPC"]),
        tile("02", "paper", "SpeciesResolve", "SpeciesResolve", "Treat species delineation as evidence, not one cutoff.", "Combines genome quality, ANI, alignment fraction, GTDB context, dereplication, and phylogenomics while preserving discordant and unresolved cases.", ["ANI", "GTDB-Tk", "dRep", "Phylogenomics"]),
        tile("03", "lime", "PanPhyloFlow", "PanPhyloFlow", "Genome → pangenome → phylogeny, without hiding the choices.", "A teaching-oriented workflow connecting annotation, Roary or Panaroo, threshold-aware summaries, IQ-TREE, and inspectable reports.", ["Nextflow", "Roary", "Panaroo", "IQ-TREE"]),
        tile("04", "paper", "PathogenPhyloFlow", "PathogenPhyloFlow", "Move from pathogen genomes to recombination-aware epidemiological evidence.", "A tested Snakemake workflow for reference assessment, core SNPs, recombination filtering, accessory-genome comparison, temporal screening, and reporting.", ["Snakemake", "Snippy", "Gubbins", "Panaroo"]),
        tile("05", "coral", "PanGWASFlow", "PanGWASFlow", "Ask which genomic features remain associated after population structure is modeled.", "Microbial GWAS across binary genomic features with PCA or Mash-MDS covariates, LRT significance, FDR control, diagnostics, and real published-data validation.", ["Python", "Snakemake", "GWAS", "Mash-MDS"]),
        tile("06", "paper", "PanOrd", "PanOrd", "Read genome-level structure inside a gene-content matrix.", "An interpretable ordination workbench using PCA, Jaccard PCoA, metadata-aware visualization, and candidate gene-cluster loadings.", ["R", "PCA", "Jaccard PCoA", "Roary"]),
        tile("07", "coral", "PanGenome-Openness-Estimator", "Openness Estimator", "Measure how a pangenome grows as genomes are added.", "Permutation-based accumulation curves and Heaps' law fitting with explicit gamma interpretation and publication-ready figures.", ["Python", "Heaps' law", "Permutation", "Visualization"]),
        tile("08", "lime", "PhyloClockLab", "PhyloClockLab", "Learn → apply → ship molecular-clock analysis.", "A learning-first laboratory for reproducible deep-time phylogenomics, beginning with manual understanding and sensitivity analysis before automation.", ["MCMCTree", "PAML", "Calibration", "Slurm"]),
    ]
    return f'''<section class="project-ecosystem" id="projects"><div class="ecosystem-intro"><div><p class="section-kicker">Open research ecosystem</p><h2>One chain of evidence.<br>An evolving toolkit.</h2></div><p>The software follows the biological reasoning: assemble a defensible cohort, resolve taxonomic uncertainty, infer evolutionary relationships, test genotype-phenotype associations, examine gene-content structure, and place change in evolutionary time.</p></div><div class="project-grid">{"".join(cards)}</div></section>'''


def visualization_ecosystem() -> str:
    cards = [
        tile("01", "lime", "biology-data-viz-matplotlib", "Matplotlib", "Engineer scientific figures below the high-level plotting call.", "Custom geometry, GridSpec, shared coordinate systems, animation, phylogenies, genome tracks, dashboards, and vector export for biological data.", ["Python", "Matplotlib", "Figure engineering", "SVG/PDF"]),
        tile("02", "paper", "biology-data-viz-seaborn", "Seaborn", "Choose statistical graphics that match the biological question.", "Tidy-data workflows, semantic mappings, distributions, uncertainty, omics exploration, reusable functions, tests, and publication exports.", ["Python", "Seaborn", "Statistics", "Omics"]),
        tile("03", "coral", "Biology-data-viz-plotly", "Plotly", "Make interaction answer an analytical question.", "Interactive biological graphics with custom hover, coordinated subplots, dashboards, animation, 3D projections, hierarchy, and reproducible HTML export.", ["Python", "Plotly", "Interactive", "Dashboards"]),
        tile("04", "paper", "Biology-data-viz-ggplot2", "ggplot2", "Use the grammar of graphics as an analytical system.", "Layered marks, transformations, scales, facets, composition, omics case studies, reusable R functions, tests, and regenerated galleries.", ["R", "ggplot2", "Tidyverse", "Omics"]),
        tile("05", "lime", "Biology-data-viz-ggtree-complexheatmap", "ggtree + ComplexHeatmap", "Keep trees, matrices, metadata, and annotations explicitly aligned.", "Phylogenomic tree annotation, tree-aligned pangenomes, annotation-rich heatmaps, oncoprints, multi-omics panels, and strict identifier checks.", ["R", "Bioconductor", "ggtree", "ComplexHeatmap"]),
        tile("06", "coral", "Biology-data-viz-shiny", "Shiny", "Turn biological exploration into a tested interactive application.", "Modular reactive analysis, interactive graphics, responsive layout, downloads, validation, server-side tests, smoke testing, and container-ready deployment.", ["R", "Shiny", "Reactive apps", "Testing"]),
    ]
    return f'''<section class="project-ecosystem" id="visualization"><div class="ecosystem-intro"><div><p class="section-kicker">Scientific data visualization</p><h2>From raw results<br>to clear evidence.</h2></div><p>A six-repository visualization series spanning Python and R. Each module is tutorial-first, reproducible, scientifically guarded, and built around biological and omics examples rather than decorative plotting.</p></div><div class="project-grid">{"".join(cards)}</div></section>'''


def toolkit() -> str:
    groups = [
        ("Pangenomics", "Roary · Panaroo · PIRATE · PPanGGOLiN"),
        ("Phylogenomics", "IQ-TREE · MAFFT · MUSCLE · iTOL · ggtree"),
        ("Statistical genomics", "GWAS · population structure · PCA/MDS · logistic regression · FDR"),
        ("Scientific visualization", "Matplotlib · Seaborn · Plotly · ggplot2 · ComplexHeatmap · Shiny"),
        ("Molecular clocks", "MCMCTree · PAML · RelTime · calibration design"),
        ("Genome comparison", "FastANI · GTDB-Tk · dRep · CheckM2"),
        ("Programming", "Python · R · Bash · Linux · Git"),
        ("Workflows &amp; HPC", "Nextflow · Snakemake · Conda · Slurm · GitHub Actions"),
    ]
    group_html = "".join(f"<div><span>{name}</span><p>{values}</p></div>" for name, values in groups)
    return f'''<section class="toolkit-section"><div class="toolkit-copy"><p class="section-kicker">Working toolkit</p><h2>Built for scale.<br>Grounded in biology.</h2><p>I work across Linux and high-performance computing environments, translating biological questions into reproducible analyses that remain inspectable from raw genomes through statistical inference to final figures.</p></div><div class="toolkit-groups">{group_html}</div></section>'''


def main() -> None:
    html = INDEX.read_text(encoding="utf-8")

    # Search metadata: retain evolutionary-genomics identity while exposing statistical genomics and visualization.
    html = re.sub(
        r'<meta name="description" content="[^"]*">',
        '<meta name="description" content="Doctoral researcher in microbial pangenomics, phylogenomics, statistical genomics, molecular clocks, scientific data visualization, astrobiology, and reproducible bioinformatics at Oakland University.">',
        html,
        count=1,
    )
    html = re.sub(
        r'<meta name="keywords" content="[^"]*">',
        '<meta name="keywords" content="Muhammad Bilal,microbial pangenomics,phylogenomics,microbial GWAS,statistical genomics,population genomics,scientific data visualization,Matplotlib,Seaborn,Plotly,ggplot2,ggtree,ComplexHeatmap,Shiny,molecular clocks,astrobiology,bioinformatics">',
        html,
        count=1,
    )
    html = html.replace(
        'Doctoral researcher connecting microbial pangenomics, phylogenomics, molecular clocks, astrobiology, and reproducible bioinformatics.',
        'Doctoral researcher connecting microbial pangenomics, phylogenomics, statistical genomics, scientific visualization, molecular clocks, astrobiology, and reproducible bioinformatics.',
    )

    # Keep the visible fallback aligned with GitHub. The existing browser-side fetch remains live.
    count = repo_count()
    if count is not None:
        html = re.sub(
            r'<strong>\d+</strong><span>public repositories</span>',
            f'<strong>{count}</strong><span>public repositories</span>',
            html,
        )
        print(f"public repository fallback: {count}")

    html = html.replace(
        'Developing linked tools for genome curation, species resolution, pangenomics, phylogenomics, ordination, and deep-time inference.',
        'Developing linked tools for genome curation, species resolution, pangenomics, phylogenomics, genotype-phenotype association, scientific visualization, ordination, and evolutionary-time inference.',
    )

    # Replace curated sections as complete units so reruns are idempotent.
    html, n = re.subn(
        r'<section class="work-preview" id="work">.*?</section>(?=<section class="project-ecosystem" id="projects">)',
        selected_software(),
        html,
        count=1,
        flags=re.S,
    )
    if n != 1:
        raise RuntimeError("could not locate selected-software section")

    html, n = re.subn(
        r'<section class="project-ecosystem" id="projects">.*?</section>(?:<section class="project-ecosystem" id="visualization">.*?</section>)?(?=<section class="toolkit-section">)',
        research_ecosystem() + visualization_ecosystem(),
        html,
        count=1,
        flags=re.S,
    )
    if n != 1:
        raise RuntimeError("could not locate research ecosystem section")

    html, n = re.subn(
        r'<section class="toolkit-section">.*?</section>(?=<section class="deep-time-section")',
        toolkit(),
        html,
        count=1,
        flags=re.S,
    )
    if n != 1:
        raise RuntimeError("could not locate toolkit section")

    INDEX.write_text(html, encoding="utf-8")
    print("portfolio catalog synchronized")


if __name__ == "__main__":
    main()
