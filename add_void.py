import re

# Read the file
with open('/var/www/jacobterrell.dev/index.html', 'r') as f:
    content = f.read()

# The Void Browser card HTML
void_card = '''                <!-- Void Browser -->
                <div class="project-card">
                    <div class="project-image" style="background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 100%);">
                        <span class="project-image-icon">🌌</span>
                    </div>
                    <div class="project-content">
                        <span class="project-tag" style="background: rgba(0, 212, 255, 0.1); color: #4fc3f7;">Desktop App</span>
                        <h3>Void Browser</h3>
                        <p><strong>Concept:</strong> A revolutionary 3D spatial web browser that transforms browsing history into an explorable universe. Navigate websites like flying through space.</p>
                        <p style="margin-top: 8px;"><strong>Features:</strong> WASD flight controls, web crawling, site previews with screenshots, link visualization, beautiful themes with bloom effects.</p>
                        <p style="margin-top: 8px; color: var(--cyan);"><strong>Tech:</strong> Built with Tauri, React Three Fiber, and Three.js for a native desktop experience.</p>
                        <div class="project-tech">
                            <span>Tauri</span>
                            <span>React</span>
                            <span>Three.js</span>
                            <span>Rust</span>
                            <span>SQLite</span>
                        </div>
                        <div class="project-links">
                            <a href="/void-browser" class="project-link">View Demo →</a>
                            <a href="https://github.com/420247jake/void-browser" target="_blank" class="project-link">GitHub →</a>
                        </div>
                    </div>
                </div>
'''

# Find the closing of projects section and insert before it
# Looking for the pattern that ends the projects-grid div
pattern = r'(            </div>\n        </div>\n    </section>\n    <!-- TECH STACK -->)'
replacement = void_card + r'\1'

new_content = re.sub(pattern, replacement, content, count=1)

# Check if replacement happened
if 'Void Browser' in new_content:
    with open('/var/www/jacobterrell.dev/index.html', 'w') as f:
        f.write(new_content)
    print('SUCCESS: Void Browser card added')
else:
    print('ERROR: Could not find insertion point')
