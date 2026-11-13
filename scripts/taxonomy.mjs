/**
 * taxonomy.mjs — the editorial source of truth for the demo corpus.
 *
 * 12 categories x 40 keywords = 480 topics. Every keyword becomes one shard file.
 * These are *topic names*, not scraped channel data. The build script turns them
 * into a deterministic, synthetic corpus so the app can be tested at 100k scale
 * without shipping copyrighted metadata.
 *
 * Keep ids stable: they appear in URLs, bookmarks and shard filenames.
 */

export const CATEGORIES = [
  {
    id: 'architecture',
    name: 'LLM Architecture',
    short: 'Architecture',
    hue: 265,
    blurb: 'How modern language models are wired inside.',
    keywords: [
      'Transformer Architecture', 'Self-Attention', 'Multi-Head Attention', 'Positional Encoding',
      'Rotary Embeddings', 'Mixture of Experts', 'Sparse Attention', 'KV Cache',
      'Context Window', 'Tokenization', 'Byte-Pair Encoding', 'Decoder-Only Models',
      'Encoder-Decoder Models', 'State Space Models', 'Mamba', 'RMSNorm',
      'Layer Normalization', 'Feed-Forward Networks', 'Gated Linear Units', 'Residual Connections',
      'Embedding Layer', 'Weight Tying', 'Sliding Window Attention', 'Grouped-Query Attention',
      'Flash Attention', 'Logit Lens', 'Activation Steering', 'Scaling Laws',
      'Chinchilla Scaling', 'Emergent Abilities', 'Chain of Thought', 'Test-Time Compute',
      'Reasoning Models', 'Attention Sinks', 'Sparse Autoencoders', 'Model Merging',
      'Depth vs Width', 'Vocabulary Design', 'Distributed Representations', 'Induction Heads'
    ]
  },
  {
    id: 'training',
    name: 'Training & Fine-Tuning',
    short: 'Training',
    hue: 205,
    blurb: 'From pretraining runs to adapters that fit on one GPU.',
    keywords: [
      'Pretraining', 'Continued Pretraining', 'Supervised Fine-Tuning', 'LoRA',
      'QLoRA', 'DoRA', 'PEFT', 'RLHF',
      'DPO', 'PPO', 'GRPO', 'Reward Modeling',
      'Instruction Tuning', 'Data Curation', 'Synthetic Data', 'Knowledge Distillation',
      'Curriculum Learning', 'Learning Rate Schedules', 'Warmup', 'Batch Size Scaling',
      'Gradient Accumulation', 'Mixed Precision Training', 'BF16', 'FP8 Training',
      'Distributed Training', 'FSDP', 'DeepSpeed', 'Megatron-LM',
      'Tensor Parallelism', 'Pipeline Parallelism', 'Gradient Checkpointing', 'Catastrophic Forgetting',
      'Overfitting', 'Regularization', 'Dropout', 'Weight Decay',
      'AdamW', 'Muon Optimizer', 'Hyperparameter Search', 'Checkpoint Selection'
    ]
  },
  {
    id: 'inference',
    name: 'Inference & Optimization',
    short: 'Inference',
    hue: 160,
    blurb: 'Latency, throughput and the economics of serving tokens.',
    keywords: [
      'Inference Latency', 'Throughput', 'Request Batching', 'Continuous Batching',
      'Paged Attention', 'vLLM', 'Quantization', 'INT8 Quantization',
      'INT4 Quantization', 'AWQ', 'GPTQ', 'GGUF',
      'llama.cpp', 'Ollama', 'TensorRT-LLM', 'ONNX Runtime',
      'torch.compile', 'CUDA Graphs', 'Kernel Fusion', 'Roofline Analysis',
      'Memory Bandwidth', 'Prefill vs Decode', 'Time to First Token', 'Tokens per Second',
      'Serving SLOs', 'GPU Autoscaling', 'Spot Instances', 'Cold Start',
      'Edge Inference', 'WebGPU Inference', 'CPU Inference', 'Model Pruning',
      'Early Exit', 'Medusa Decoding', 'EAGLE Decoding', 'KV Cache Compression',
      'Prompt Caching', 'Structured Output', 'Speculative Sampling', 'Serving Benchmarks'
    ]
  },
  {
    id: 'rag',
    name: 'Retrieval & RAG',
    short: 'RAG',
    hue: 30,
    blurb: 'Grounded answers depend on retrieval, not on luck.',
    keywords: [
      'Retrieval Augmented Generation', 'Embeddings', 'Embedding Models', 'Vector Database',
      'Cosine Similarity', 'HNSW', 'IVF Index', 'Product Quantization',
      'Hybrid Search', 'BM25', 'Reranking', 'Cross Encoder',
      'Bi Encoder', 'Chunking Strategies', 'Semantic Chunking', 'Document Loaders',
      'Metadata Filtering', 'Multi-Query Retrieval', 'HyDE', 'Contextual Retrieval',
      'Graph RAG', 'Knowledge Graphs', 'Long Context vs RAG', 'RAG Evaluation',
      'Faithfulness', 'Groundedness', 'Citation Generation', 'Query Rewriting',
      'Query Decomposition', 'Agentic RAG', 'Table Retrieval', 'Multimodal RAG',
      'PDF Parsing', 'OCR Pipelines', 'Recency Ranking', 'Access Control in RAG',
      'Cache Augmented Generation', 'Retrieval Latency', 'Embedding Drift', 'Memory vs Retrieval'
    ]
  },
  {
    id: 'agents',
    name: 'Agents & Tooling',
    short: 'Agents',
    hue: 320,
    blurb: 'Loops, tools, memory and permission boundaries.',
    keywords: [
      'AI Agents', 'Tool Use', 'Function Calling', 'Model Context Protocol',
      'Agentic Loops', 'Planning', 'Task Decomposition', 'Reflection',
      'Self-Critique', 'Multi-Agent Systems', 'Orchestrator Worker', 'Agent Swarms',
      'ReAct Pattern', 'Tree of Thoughts', 'Agent Memory', 'Episodic Memory',
      'Semantic Memory', 'Scratchpad', 'Guardrails', 'Sandboxed Execution',
      'Code Interpreter', 'Browser Automation', 'Computer Use', 'Workflow Automation',
      'Durable Execution', 'Human in the Loop', 'Approval Gates', 'Agent Observability',
      'Tracing', 'Agent Evals', 'Agent Benchmarks', 'SWE-bench',
      'WebArena', 'GAIA Benchmark', 'Browser Agents', 'Coding Agents',
      'Agent Cost Control', 'Tool Schemas', 'Prompt Injection Defense', 'Agent Handoff'
    ]
  },
  {
    id: 'multimodal',
    name: 'Multimodal AI',
    short: 'Multimodal',
    hue: 190,
    blurb: 'Seeing, hearing and grounding models in the physical world.',
    keywords: [
      'Vision Language Models', 'Multimodal Embeddings', 'Image Captioning', 'OCR',
      'Document Understanding', 'Video Understanding', 'Audio Understanding', 'Speech Recognition',
      'Whisper', 'Text to Speech', 'Voice Cloning', 'Real-Time Voice Agents',
      'Vision Transformers', 'CLIP', 'SigLIP', 'Image Segmentation',
      'Segment Anything', 'Object Detection', 'Visual Grounding', 'Visual Question Answering',
      'Chart Understanding', 'UI Understanding', 'Screenshot Agents', 'Spatial Reasoning',
      'Music Understanding', 'Emotion Recognition', 'Multilingual ASR', 'Streaming ASR',
      'Speaker Diarization', 'Image Editing Models', 'Diffusion Transformers', 'ControlNet',
      'Inpainting', 'Super Resolution', 'Depth Estimation', 'Pose Estimation',
      '3D Reconstruction', 'Gaussian Splatting', 'NeRF', 'Lip Sync'
    ]
  },
  {
    id: 'media',
    name: 'Generative Media',
    short: 'Media',
    hue: 345,
    blurb: 'Pixels, frames, music and the workflows around them.',
    keywords: [
      'Stable Diffusion', 'Latent Diffusion', 'Diffusion Models', 'Flow Matching',
      'GANs', 'VAE', 'Text Encoders', 'Classifier-Free Guidance',
      'Sampling Schedulers', 'Image Prompt Engineering', 'Style Transfer', 'Image to Image',
      'Video Diffusion', 'Text to Video', 'Image to Video', 'Animation',
      'Character Consistency', 'Image LoRA', 'IP-Adapter', 'Face Swap Ethics',
      'Generative Audio', 'Music Generation', 'Sound Effects', 'Voice Design',
      'AI Avatars', 'Virtual Influencers', 'Upscaling', 'Background Removal',
      'Product Photography', 'AI Filmmaking', 'Storyboarding', 'Generative 3D Assets',
      'Texture Generation', 'Game Asset Generation', 'Creative Rights', 'Watermarking Media',
      'Deepfake Detection', 'Provenance Metadata', 'Generative Video Editing', 'Motion Control'
    ]
  },
  {
    id: 'mlops',
    name: 'MLOps & Infrastructure',
    short: 'MLOps',
    hue: 15,
    blurb: 'The unglamorous machinery that keeps models alive.',
    keywords: [
      'MLOps', 'Model Registry', 'Experiment Tracking', 'MLflow',
      'Weights and Biases', 'Feature Store', 'Data Versioning', 'DVC',
      'Reproducibility', 'CI CD for ML', 'Model Packaging', 'Docker for GPU',
      'Kubernetes GPU', 'NVIDIA GPU Operator', 'GPU Scheduling', 'Multi-Cloud GPU',
      'Cost per Token', 'Capacity Planning', 'Observability', 'Prometheus',
      'OpenTelemetry', 'Log Aggregation', 'Drift Detection', 'Shadow Deployment',
      'Canary Rollout', 'A/B Testing Models', 'Incident Response', 'Model Rollback',
      'SLO Design', 'PII Redaction', 'Secrets Management', 'Rate Limiting',
      'API Gateway', 'Caching Layer', 'Queueing', 'Backpressure',
      'Load Testing LLM APIs', 'Chaos Engineering', 'Disaster Recovery', 'On-Prem LLM'
    ]
  },
  {
    id: 'data',
    name: 'Data Engineering',
    short: 'Data',
    hue: 85,
    blurb: 'Pipelines, formats and the quality of what goes in.',
    keywords: [
      'Data Pipelines', 'ETL vs ELT', 'Batch Processing', 'Stream Processing',
      'Kafka', 'Flink', 'Spark', 'DuckDB',
      'Parquet', 'Apache Iceberg', 'Delta Lake', 'Data Lakehouse',
      'Data Modeling', 'dbt', 'Airflow', 'Dagster',
      'Orchestration', 'Schema Evolution', 'Data Quality', 'Great Expectations',
      'Deduplication', 'Entity Resolution', 'Web Scraping', 'Crawling Ethics',
      'robots.txt', 'Data Licensing', 'Dataset Annotation', 'Label Quality',
      'Active Learning', 'Weak Supervision', 'Data Flywheel', 'Synthetic Data Pipelines',
      'Tokenizer Training Data', 'Dedup for Pretraining', 'PII in Datasets', 'Dataset Contamination',
      'Benchmark Leakage', 'Data Retention', 'Columnar Formats', 'Embedding Pipelines'
    ]
  },
  {
    id: 'eval',
    name: 'Evaluation & Safety',
    short: 'Eval & Safety',
    hue: 45,
    blurb: 'Measurement, judgment and the limits of both.',
    keywords: [
      'LLM Evaluation', 'Benchmarks', 'MMLU', 'HellaSwag',
      'GSM8K', 'HumanEval', 'Pass at K', 'LLM as Judge',
      'Pairwise Evaluation', 'Rubric Design', 'Eval Contamination', 'Red Teaming',
      'Jailbreaks', 'Prompt Injection', 'Adversarial Prompts', 'Hallucination Detection',
      'Factuality', 'Toxicity Filters', 'Bias Evaluation', 'Alignment',
      'Constitutional AI', 'Interpretability', 'Mechanistic Interpretability', 'Sparse Autoencoder Probes',
      'Probing Classifiers', 'Safety Classifiers', 'Content Moderation', 'Model Cards',
      'Data Cards', 'Transparency Reports', 'Audit Trails', 'Privacy Attacks',
      'Membership Inference', 'Differential Privacy', 'Federated Learning', 'Machine Unlearning',
      'Copyright Risk', 'Guardrail Evaluation', 'Incident Taxonomy', 'Evaluation Harnesses'
    ]
  },
  {
    id: 'product',
    name: 'Product & Design',
    short: 'Product',
    hue: 285,
    blurb: 'Interfaces, pricing and trust for AI products.',
    keywords: [
      'AI Product Strategy', 'AI UX Patterns', 'Chat UI', 'Streaming UI',
      'Generative UI', 'Copilot Patterns', 'Human AI Collaboration', 'Trust Calibration',
      'Uncertainty Display', 'Citations UI', 'Prompt Suggestions', 'Onboarding for AI',
      'Empty States', 'Latency Perception', 'Progressive Disclosure', 'Error Recovery',
      'AI Pricing', 'Usage-Based Pricing', 'Credits', 'Freemium for AI',
      'Cost Transparency', 'Product Metrics', 'Activation Metrics', 'Retention for AI Apps',
      'Evaluation-Driven Development', 'AI Prototyping', 'Vibe Coding', 'No-Code AI',
      'Workflow Design', 'Task Automation ROI', 'Change Management', 'AI Adoption',
      'Developer Experience', 'API Design for LLMs', 'SDK Design', 'Documentation for AI',
      'Responsible AI Policy', 'Model Selection', 'Build vs Buy', 'Vendor Lock-In'
    ]
  },
  {
    id: 'research',
    name: 'Research Frontiers',
    short: 'Research',
    hue: 235,
    blurb: 'Open questions, hard benchmarks and the next architecture.',
    keywords: [
      'AGI Debate', 'Scaling Hypothesis', 'World Models', 'JEPA',
      'Neurosymbolic AI', 'Causal Inference', 'Reinforcement Learning', 'RL Environments',
      'Sim2Real', 'Robotics Foundation Models', 'Vision Language Action', 'Embodied AI',
      'Autonomous Driving', 'Protein Folding', 'AlphaFold', 'AI for Science',
      'Drug Discovery', 'Materials Discovery', 'Weather Forecasting', 'Math Reasoning',
      'Theorem Proving', 'Lean Prover', 'Code Generation Research', 'Program Synthesis',
      'Self-Improving Models', 'Recursive Self-Improvement', 'Synthetic Reasoning Data', 'CoT Faithfulness',
      'Latent Reasoning', 'Test-Time Scaling', 'Continual Learning', 'Memory Architectures',
      'Long Context Research', 'State Space Duality', 'Mamba-2', 'Mixture of Depths',
      'Activation Oracles', 'Model Organisms', 'Emergent Misalignment', 'Compute Governance'
    ]
  }
];

/** Channel pools per category. Fictional but plausible; no real channel names. */
export const CHANNELS = {
  architecture: [
    'Latent Space Notes', 'The Residual Stream', 'Attention Lab', 'Paper Bytes',
    'Token Mechanics', 'Architecture Weekly', 'Inside the Model', 'Gradient Signal',
    'Deep Net Diaries', 'Head Count', 'Sequence & Structure', 'The Decoder',
    'Layer by Layer', 'Context Window', 'Embedding Space', 'Scaling Notes'
  ],
  training: [
    'Loss Curve Club', 'Checkpoint Charlie', 'Fine-Tune Friday', 'The Training Run',
    'GPU Hours', 'Batch Size', 'Warmup Steps', 'Pretrain Podcast',
    'The Adapter Files', 'Data Curation Desk', 'Optimizer Notes', 'RLHF Weekly',
    'Gradient Descent Diaries', 'Compute Budget', 'Epoch Stories', 'Distillation Lab'
  ],
  inference: [
    'Tokens Per Second', 'The Serving Stack', 'Latency Budget', 'GPU Whisperer',
    'Quantized', 'Kernel Notes', 'Prefill', 'Cold Start Club',
    'Throughput Lab', 'The Edge Runtime', 'Batch Window', 'Speculative',
    'Compile & Serve', 'VRAM Diaries', 'Serving SLOs', 'Decode Phase'
  ],
  rag: [
    'Retrieval Weekly', 'The Context Layer', 'Chunk & Rerank', 'Vector Notes',
    'Grounded', 'Citation Needed', 'The Index', 'Hybrid Search Lab',
    'Knowledge Base', 'Embedding Ops', 'RAG Applied', 'Document AI',
    'Semantic Layer', 'Recall at K', 'The Retriever', 'Graph Retrieval'
  ],
  agents: [
    'Agent Loop', 'Tool Call', 'The Orchestrator', 'Sandbox Notes',
    'Approval Gate', 'Agent Ops', 'Loop Engineering', 'Multi-Agent Desk',
    'Computer Use Weekly', 'Trace & Eval', 'Agentic Patterns', 'The Handoff',
    'Autonomy Levels', 'Guardrail Notes', 'Browser Agent Lab', 'Task Graph'
  ],
  multimodal: [
    'Vision Tokens', 'Audio & Pixels', 'The Multimodal Desk', 'Frame by Frame',
    'Speech Stack', 'Pixel Grounding', 'Sight & Sound', 'Camera Roll AI',
    'Voice Interface', 'Document Vision', 'Video Understanding Lab', 'Spatial Notes',
    'Depth & Motion', 'Caption This', 'The Encoder Room', 'Waveform'
  ],
  media: [
    'Latent Canvas', 'Diffusion Daily', 'Frame Foundry', 'Prompt & Palette',
    'Motion Lab', 'Sound Design AI', 'Generative Studio', 'The Render Queue',
    'Style Guide', 'Asset Forge', 'Film & Model', 'Character Sheet',
    'Texture Club', 'Post & Process', 'Creative Controls', 'The Noise Schedule'
  ],
  mlops: [
    'Uptime Notes', 'The Registry', 'GPU Fleet', 'Cost Per Token',
    'Deploy & Observe', 'Incident Review', 'Pipeline Ops', 'Infra Weekly',
    'Queue Depth', 'Capacity Desk', 'Model Rollback', 'SRE for AI',
    'The Canary', 'Platform Notes', 'Cluster Ops', 'Reliability Lab'
  ],
  data: [
    'Pipeline Thoughts', 'Parquet & Prose', 'The Data Lakehouse', 'Schema Drift',
    'Label Quality', 'Curation Notes', 'Batch & Stream', 'Dagster Diaries',
    'Data Contracts', 'Dedup Lab', 'Lakehouse Weekly', 'Columnar',
    'Ingest', 'The Feature Table', 'Provenance Notes', 'Dataset Audit'
  ],
  eval: [
    'Eval Weekly', 'The Rubric', 'Red Team Notes', 'Judge & Jury',
    'Benchmark Watch', 'Safety Surface', 'Interpretability Lab', 'Probe Notes',
    'Model Cards', 'Trust & Measure', 'Alignment Desk', 'Contamination Check',
    'Guardrail Review', 'Fact Check', 'Audit Log', 'Policy & Practice'
  ],
  product: [
    'Ship & Learn', 'The Interface', 'AI Product Notes', 'Trust by Design',
    'Latency & Delight', 'The Onboarding', 'Pricing Experiments', 'Copilot Craft',
    'Human in the Loop', 'Product Signals', 'Build vs Buy', 'The Roadmap',
    'AI Adoption Desk', 'Design for Uncertainty', 'Activation Lab', 'The Brief'
  ],
  research: [
    'Frontier Notes', 'The Open Question', 'Paper of the Week', 'Lab Notebook',
    'Reasoning Research', 'Embodied Lab', 'Science & Models', 'The Long Horizon',
    'Compute & Governance', 'Emergence Watch', 'Research Replications', 'Hard Benchmarks',
    'World Model Lab', 'Theorem & Tensor', 'Frontier Safety', 'The Reading Group'
  ]
};

/** Title fragments keep synthetic titles varied without pretending to be real videos. */
export const TITLE_PREFIXES = [
  '', '', '', 'Explained: ', 'Deep Dive: ', 'From Scratch: ', 'In 12 Minutes: ',
  'The Real Cost of ', 'Why ', 'How ', 'Building ', 'Debugging ', 'Benchmarking ',
  'Rethinking ', 'A Practical Guide to ', 'What Nobody Tells You About ', 'Inside ',
  'Scaling ', 'Evaluating ', 'Shipping ', 'Migrating to ', 'Comparing ', 'Beyond ',
  'The Problem With ', 'A Field Guide to ', 'Lessons From ', 'When to Use '
];

export const TITLE_SUFFIXES = [
  '', '', '', ' (2026)', ' — Full Walkthrough', ' | Production Notes', ' for Teams',
  ' — Common Pitfalls', ' Explained Simply', ' with Code', ' — Benchmark Results',
  ' at Scale', ' in 2026', ' — What Actually Works', ' for Backend Engineers',
  ' — A 30-Minute Deep Dive', ' Without the Hype', ' — Field Notes'
];

export const CHANNEL_SUFFIXES = ['', ' HQ', ' Labs', ' Studio', ' Weekly', ' Notes'];
