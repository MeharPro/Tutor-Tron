console.log('lesson-maker.js loaded');

// Global variables
let slides = [];
let currentSlide = 0;
let isProcessing = false;
let isProUser = false;
let currentEditingSlideIndex = -1;
let currentEditingImage = null;
let usedImages = new Set();
let slideshowTitle = null;

// Base64 encoded placeholder image
const placeholderImage = 'data:image/svg+xml;base64,' + btoa(`
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f0f0f0"/>
    <text x="50%" y="50%" font-family="Arial" font-size="20" text-anchor="middle">Image loading...</text>
</svg>
`);

// Function to check authentication and pro status (No changes)
async function checkAuthAndProStatus() {
    const token = localStorage.getItem('teacherToken');
    if (!token) {
        window.location.href = '/index.html';
        return false;
    }

    try {
        const response = await fetch('/api/pro/status', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/index.html';
                return false;
            }
            throw new Error('Failed to check pro status');
        }

        const data = await response.json();
        if (!data.isPro) {
            alert('This feature is only available for Pro/Plus Users. Please upgrade your account to access this feature.');
            window.location.href = '/subscription';
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error checking pro status:', error);
        alert('Error checking subscription status. Please try again later.');
        window.location.href = '/dashboard';
        return false;
    }
}

// Helper function to test if an image can be loaded (Improved)
function testImageLoad(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        let timeoutId;

        img.onload = () => {
            clearTimeout(timeoutId);
            resolve(url);
        };

        img.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error('Failed to load image'));
        };

        img.src = url;

        // Timeout after 5 seconds
        timeoutId = setTimeout(() => {
            reject(new Error('Image load timeout'));
        }, 5000);
    });
}

async function searchImage(query) {
    try {
        console.log('Searching for image:', query);

        const token = localStorage.getItem('teacherToken');
        if (!token) {
            console.error('No auth token found');
            return placeholderImage;
        }

        // First try to get image from our API
        try {
            const response = await fetch('/api/pro/image-search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ query })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.imageUrl && !usedImages.has(data.imageUrl)) {
                    usedImages.add(data.imageUrl);
                    await testImageLoad(data.imageUrl);
                    console.log('Successfully loaded image from API:', data.imageUrl);
                    return data.imageUrl;
                }
            } else {
                // Handle API errors gracefully!
                console.error('API image search failed:', response.status);
            }
        } catch (err) {
            console.error('API image search failed (catch):', err);
        }

        // Simplify the query for Pixabay
        const simplifiedQuery = simplifySearchQuery(query);

        // Fallback to Pixabay
        const apiKey = '48005232-8a2e6b19f729a51341918481a'; // Replace with your API Key
        const pixabayUrl = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(simplifiedQuery)}&image_type=photo&orientation=horizontal&safesearch=true&per_page=20`;

        const response = await fetch(pixabayUrl);
        if (!response.ok) {
            console.error(`Pixabay API error: ${response.status}`);
            return placeholderImage; // Return placeholder on Pixabay error
        }

        const data = await response.json();
        console.log('Pixabay API response:', data);

        if (data.hits && data.hits.length > 0) {
            // Filter out already used images and try each remaining one
            const unusedImages = data.hits.filter(hit => !usedImages.has(hit.largeImageURL));

            for (const hit of unusedImages) {
                const imageUrl = hit.largeImageURL;
                try {
                    await testImageLoad(imageUrl);
                    usedImages.add(imageUrl);
                    console.log('Successfully loaded image:', imageUrl);
                    return imageUrl;
                } catch (err) {
                    console.log('Failed to load image, trying next one:', err);
                    continue; // Continue to the next image if one fails
                }
            }
        }

        console.log('No unused images found, using placeholder');
        return placeholderImage;
    } catch (error) {
        console.error('Error in image search:', error);
        return placeholderImage;
    }
}

// Helper function to simplify search queries (No changes)
function simplifySearchQuery(query) {
    const keywords = query.toLowerCase()
        .replace(/^image:?\s*/i, '')
        .replace(/\{|\}/g, '')
        .replace(/\+/g, ' ')
        .split(/[,.]/)
        [0]
        .split(' ')
        .filter(word =>
            word.length > 2 &&
            !['the', 'and', 'for', 'with', 'that', 'this', 'are', 'was', 'were', 'will', 'have', 'has', 'had'].includes(word)
        )
        .slice(0, 3)
        .join(' ')
        .trim();

    console.log('Simplified query:', keywords);
    return keywords;
}

async function formatSlideContent(content, isFirstSlide = false) {
    if (!content) return '';

    let formattedContent = content;

    const imageRegex = /Image: {IMAGE} \+ {([^}]+)}/g;
    const matches = [...content.matchAll(imageRegex)];

    let imageSection = '';
    if (matches.length > 0) {
        const description = matches[0][1].trim();
        const imageUrl = await searchImage(description);

        imageSection = `
            <div class="slide-image">
                <div class="image-wrapper" style="width: 100%; height: 450px; display: flex; align-items: center; justify-content: center;">
                    <img src="${imageUrl}"
                         alt="${description}"
                         style="max-width: 500px; max-height: 300px; width: auto; height: auto; object-fit: contain;"
                         onerror="if (this.src !== '${placeholderImage}') this.src='${placeholderImage}';">
                </div>
                <p class="image-caption" style="margin-top: 5px; color: #666; font-size: 14px; text-align: center;">${description}</p>
            </div>
        `;
        formattedContent = formattedContent.replace(imageRegex, '');
    }

    if (isFirstSlide) {
        const lines = formattedContent.split('\n').filter(line => line.trim());
        const title = lines.find(line => line.startsWith('#'))?.replace('#', '').trim() || '';
        const catchySentence = lines.find(line => !line.startsWith('#') && !line.startsWith('-'))?.trim() || '';

        formattedContent = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 100%; max-width: 800px; text-align: center;">
                <h1 style="font-size: 52px; color: #1a1a1a; margin: 0 0 40px; line-height: 1.2;">${title}</h1>
                <p id="firstSlideCatchy" style="font-size: 32px; color: #333; margin: 0; line-height: 1.4; font-style: italic;">${catchySentence}</p>
            </div>
        `;
    } else {
        formattedContent = formattedContent
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^- (.*$)/gm, '<li>$1</li>')
            .trim();

        if (formattedContent.includes('<li>')) {
            formattedContent = '<ul>' + formattedContent + '</ul>';
        }
    }

    return formattedContent + imageSection;
}

async function generateSlides(topic, slideCount) {
    try {
        usedImages.clear();
        isProcessing = true;

        const token = localStorage.getItem('teacherToken');
        if (!token) {
            window.location.href = '/index.html';
            return;
        }

        const systemPrompt = `You are a lesson maker and you have to create a presentation. Your task is to generate EXACTLY ${slideCount} slides about "${topic}".  This is an outline, you have to explain the topics in detail, and ensure that it explains the concept in the most engaging way possible while keeping it concise. You MUST use this EXACT format with no deviations:

{{Name of the presentation}} - LESS than 3 words. It must be inside the double curly brackets.

{Slide 1}
# Introduction to the ${topic} (Rephrase this to make it more engaging)
A catchy sentence about the ${topic}
- NO BULLET POINTS
- NO IMAGE

{Slide 2}
# Concept Title
- Information about the concept, etc.
Image: {IMAGE} + {1-3 words image description for a stock image}

...

{Slide ${slideCount}}
# Conclusion
- Summary of the presentation
- In 3 bullet points, summarize the main points.
- Any final notes about the topic.
etc...

IMPORTANT FORMATTING RULES:
1.  Each slide section MUST start with {Slide X} on its own line
2.  Each slide MUST have a title starting with single # symbol
3.  Each slide MUST have exactly 4-5 bullet points starting with "-"
4.  Each slide MUST end with exactly one image in format:  Image: {IMAGE} + {1-3 words image description for a stock image}, except the first slide.
5.  Each image MUST have a different description.
6.  Do not include any extra text or explanations
7.  Keep the exact same format for all slides

Remember: The {Slide X} marker is crucial for parsing. Each slide must be properly marked.`;

        const response = await fetch('/api/pro/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                message: topic,
                subject: 'Slide Presentation',
                prompt: systemPrompt,
                mode: 'lesson',
                messageHistory: [{
                    role: 'system',
                    content: systemPrompt
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Full API Response:', data);
        console.log('Response type:', typeof data.response);
        console.log('Raw response text:', data.response);

        const lines = data.response.split('\n');
        console.log('First few lines:', lines.slice(0, 5));

        const nameRegex = /{{([^}]+)}}/;
        let presentationName = 'presentation';

        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const match = lines[i].match(nameRegex);
            if (match && match[1]) {
                presentationName = match[1].trim();
                console.log('Found presentation name on line', i + 1, ':', presentationName);
                break;
            }
        }

        const titleElement = document.getElementById('slideshowTitle');
        if (titleElement) {
            console.log('Previous title:', titleElement.textContent);
            titleElement.textContent = presentationName;
            window.presentationName = presentationName;
            console.log('Updated title to:', titleElement.textContent);
            console.log('Stored name as:', window.presentationName);
        }

        const slideRegex = /{Slide \d+}([\s\S]*?)(?={Slide \d+}|$)/g;
        const slideMatches = [...data.response.matchAll(slideRegex)];

        if (slideMatches.length === 0) {
            throw new Error('No slides found in the response');
        }

        slides = [];
        for (const match of slideMatches) {
            const content = match[1].trim();
            const formatted = await formatSlideContent(content, slides.length === 0);
            slides.push({
                content: content,
                formatted: formatted
            });
        }

        currentSlide = 0;
        await updateUI();
        updateSlidesList();

        const preview = document.getElementById('slidePreview');
        preview.focus();

    } catch (error) {
        console.error('Error generating slides:', error);
        alert('Failed to generate slides. Please try again.');
    } finally {
        isProcessing = false;
    }
}

async function saveCurrentSlide() {
    const preview = document.getElementById('slidePreview');
    if (!slides[currentSlide]) return;

    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = preview.innerHTML;

    let originalContent = slides[currentSlide].content;

    originalContent = originalContent.replace(/Image: {IMAGE} \+ {[^}]+}/g, '').trim();

    const images = tempContainer.querySelectorAll('.slide-image');
    images.forEach(imageDiv => {
        const img = imageDiv.querySelector('img');
        const caption = imageDiv.querySelector('.image-caption');
        if (img && caption) {
            originalContent += `\nImage: {IMAGE} + {${caption.textContent.trim()}}`;
        }
    });

    slides[currentSlide].content = originalContent;
    slides[currentSlide].formatted = preview.innerHTML;
}


async function updateUI() {
    const preview = document.getElementById('slidePreview');
    if (!slides[currentSlide]) return;

    const scrollPos = preview.scrollTop;

    try {
        if (slides[currentSlide].formatted) {
            preview.innerHTML = slides[currentSlide].formatted;
        } else {
            const formattedContent = await formatSlideContent(slides[currentSlide].content, currentSlide === 0);
            slides[currentSlide].formatted = formattedContent;
            preview.innerHTML = formattedContent;
        }

        const images = preview.getElementsByTagName('img');
        for (let img of images) {
            img.style.cursor = 'pointer';
            img.onclick = function() { // Breakpoint here for debugging
                console.log("Image clicked!"); // Debugging log
                showImageDialog(currentSlide, img, img.alt);
            };
        }

        preview.scrollTop = scrollPos;

        document.querySelectorAll('.slide-item').forEach((item, index) => {
            item.classList.toggle('active', index === currentSlide);
        });

        preview.tabIndex = 0;
    } catch (error) {
        console.error('Error updating UI:', error);
    }
}

async function updatePreview() {
    console.log('Updating preview');
    const preview = document.getElementById('slidePreview');
    if (!slides[currentSlide]) {
        console.log('No content for current slide');
        preview.innerHTML = '<p>No content yet. Start typing in the editor!</p>';
        return;
    }

    const content = slides[currentSlide].content;
    console.log('Formatting content for preview:', content);
    preview.innerHTML = await formatSlideContent(content, currentSlide === 0);
    console.log('Updated preview HTML:', preview.innerHTML);
}

async function exportSlides() {
    try {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingTitle = loadingOverlay.querySelector('h2');
        loadingOverlay.style.display = 'flex';
        loadingTitle.textContent = 'Exporting PDF...';
        isProcessing = true;

        const pdf = new jspdf.jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [1280, 720]
        });

        for (let i = 0; i < slides.length; i++) {
            const slideContent = slides[i].formatted;

            const container = document.createElement('div');
            container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 1280px;
                height: 720px;
                background: white;
                padding: 40px;
                box-sizing: border-box;
                display: flex;
                font-family: 'Inter', sans-serif;
                z-index: -1;
                overflow: hidden;
            `;

            const contentContainer = document.createElement('div');
            contentContainer.style.cssText = `
                flex: 0 0 50%;
                padding-right: 20px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            `;

            const imageContainer = document.createElement('div');
            imageContainer.style.cssText = `
                flex: 0 0 50%;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                padding-left: 20px;
            `;

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = slideContent;

            Array.from(tempDiv.children).forEach(child => {
                if (!child.classList.contains('slide-image')) {
                    contentContainer.appendChild(child);
                } else {
                    imageContainer.appendChild(child);
                }
            });

            const h1Elements = contentContainer.getElementsByTagName('h1');
            for (const h1 of h1Elements) {
                h1.style.cssText = `
                    font-size: 42px;
                    color: #1a1a1a;
                    margin-bottom: 25px;
                    width: 100%;
                    line-height: 1.2;
                `;
            }

            const ulElements = contentContainer.getElementsByTagName('ul');
            for (const ul of ulElements) {
                ul.style.cssText = `
                    font-size: 28px;
                    color: #333;
                    margin: 10px 0;
                    padding-left: 20px;
                    list-style-type: none;
                    line-height: 1.3;
                `;

                const lis = ul.getElementsByTagName('li');
                for (const li of lis) {
                    li.style.cssText = `
                        margin: 10px 0;
                        position: relative;
                        padding-left: 20px;
                        font-size: 28px;
                    `;
                    li.insertBefore(document.createTextNode('• '), li.firstChild);
                }
            }

            const imgContainers = imageContainer.getElementsByClassName('slide-image');
            for (const imgContainer of imgContainers) {
                imgContainer.style.cssText = `
                    width: 100%;
                    height: auto;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                `;

                const wrapper = imgContainer.querySelector('.image-wrapper');
                if (wrapper) {
                    wrapper.style.cssText = `
                        width: 100%;
                        height: ${container.clientHeight - 120}px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                    `;
                }

                const img = imgContainer.querySelector('img');
                if (img) {
                    const captionHeight = imgContainer.querySelector('.image-caption') ? 40 : 0;
                    const availableHeight = container.clientHeight - 80 - captionHeight;
                    const maxWidth = imageContainer.clientWidth - 40; // Account for padding

                    img.style.cssText = `
                        max-width: ${maxWidth}px;
                        max-height: ${availableHeight}px;
                        width: auto;
                        height: auto;
                        object-fit: contain;
                        margin: 0;
                    `;

                    // Force natural aspect ratio
                    img.onload = () => {
                        const aspectRatio = img.naturalWidth / img.naturalHeight;
                        const maxWidth = wrapper.clientWidth;
                        const maxHeight = wrapper.clientHeight;

                        if (maxWidth / maxHeight > aspectRatio) {
                            img.style.height = Math.min(maxHeight, img.naturalHeight) + 'px';
                            img.style.width = 'auto';
                        } else {
                            img.style.width = Math.min(maxWidth, img.naturalWidth) + 'px';
                            img.style.height = 'auto';
                        }
                    };
                }

                const caption = imgContainer.querySelector('.image-caption');
                if (caption) {
                    caption.style.cssText = `
                        font-size: 16px;
                        color: #666;
                        text-align: center;
                        margin-top: 8px;
                        max-width: 100%;
                        padding: 0 10px;
                    `;
                }
            }

            // Add containers to main container
            container.appendChild(contentContainer);
            container.appendChild(imageContainer);

            // Add to document for rendering
            document.body.appendChild(container);

            // Convert to image and add to PDF
            const canvas = await html2canvas(container, {
                width: 1280,
                height: 720,
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false
            });

            const imgData = canvas.toDataURL('image/jpeg', 1.0);

            if (i > 0) {
                pdf.addPage();
            }

            pdf.addImage(imgData, 'JPEG', 0, 0, 1280, 720);

            // Clean up
            document.body.removeChild(container);
        }

        // Save the PDF with presentation name
        const fileName = (window.presentationName || 'presentation').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        console.log('Saving PDF as:', fileName + '.pdf');
        pdf.save(`${fileName}.pdf`);

    } catch (error) {
        console.error('Error exporting slides:', error);
        alert('Failed to export slides. Please try again.');
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
        isProcessing = false;
    }
}

async function exportToPPTX() {
    if (!isProUser) {
        alert('This feature is only available for Pro/Plus Users. Please upgrade your account to access this feature.');
        return;
    }

    try {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingTitle = loadingOverlay.querySelector('h2');
        loadingOverlay.style.display = 'flex';
        loadingTitle.textContent = 'Exporting PowerPoint...';

        // Get the presentation name from window
        const fileName = (window.presentationName || 'presentation').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        console.log('Using presentation name for export:', fileName);

        const pptx = new PptxGenJS();
        pptx.layout = 'LAYOUT_16x9';
        const usedPptxImages = new Set(); // Track used images for this export

        for (let i = 0; i < slides.length; i++) {
            const slide = pptx.addSlide();

            // Create a temporary container to render the slide content
            const container = document.createElement('div');
            container.innerHTML = slides[i].formatted;

            if (i === 0) {
                // Special formatting for first slide
                const h1 = container.querySelector('h1');
                const catchyText = container.querySelector('#firstSlideCatchy');
                console.log('Found catchy text element:', catchyText);
                const subtitleText = catchyText ? catchyText.textContent.trim() : '';
                console.log('Subtitle text:', subtitleText);

                if (h1) {
                    slide.addText(h1.textContent, {
                        x: '10%',
                        y: '25%',  // Moved up
                        w: '80%',
                        fontSize: 42,
                        bold: true,
                        color: '1a1a1a',
                        align: 'center',
                        fit: true  // Enable auto-fitting
                    });
                }

                if (subtitleText) {
                    console.log('Adding subtitle to slide');
                    slide.addText(subtitleText, {
                        x: '10%',
                        y: '60%',  // Moved down
                        w: '80%',
                        fontSize: 32,
                        italic: true,  // Changed from isItalic to italic
                        color: '333333',
                        align: 'center',
                        fontFace: 'Arial'
                    });
                }
            } else {
                // Regular slides
                const h1 = container.querySelector('h1');
                if (h1) {
                    slide.addText(h1.textContent, {
                        x: 0.5,
                        y: 0.3,
                        w: '90%',
                        h: 0.8,
                        fontSize: 44,
                        bold: true,
                        color: '1a1a1a',
                        align: 'left',
                        fit: true  // Enable auto-fitting
                    });
                }

                // Extract bullet points
                const bulletPoints = container.querySelectorAll('li');
                if (bulletPoints.length > 0) {
                    const bulletPointsData = Array.from(bulletPoints).map(li => ({
                        text: li.textContent.replace('• ', ''), // Remove existing bullet
                        options: {
                            bullet: true,
                            fontSize: 20, // Reduced font size
                            color: '333333',
                            breakLine: true,
                            paraSpaceBefore: 2, // Add space before each point
                            paraSpaceAfter: 2 // Add space after each point
                        }
                    }));

                    slide.addText(bulletPointsData, {
                        x: 0.5,
                        y: 1.1, // Move up slightly
                        w: '45%',
                        h: 3.5, // Reduced height
                        align: 'left',
                        lineSpacing: 20 // Reduced line spacing
                    });
                }

                // Extract and add image
                const img = container.querySelector('img');
                if (img && img.src !== placeholderImage && !usedPptxImages.has(img.src)) {
                    try {
                        const response = await fetch(img.src);
                        const blob = await response.blob();
                        const imageData = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });

                        // Load image to get natural dimensions
                        const imgDimensions = await new Promise((resolve) => {
                            const tempImg = new Image();
                            tempImg.onload = () => resolve({
                                width: tempImg.naturalWidth,
                                height: tempImg.naturalHeight
                            });
                            tempImg.src = img.src;
                        });

                        // Calculate dimensions maintaining aspect ratio
                        const maxWidth = 5.5;
                        const maxHeight = 4;
                        const aspectRatio = imgDimensions.width / imgDimensions.height;

                        let finalWidth, finalHeight;
                        if (aspectRatio > 1) {
                            finalWidth = Math.min(maxWidth, maxWidth);
                            finalHeight = finalWidth / aspectRatio;
                            if (finalHeight > maxHeight) {
                                finalHeight = maxHeight;
                                finalWidth = finalHeight * aspectRatio;
                            }
                        } else {
                            finalHeight = Math.min(maxHeight, maxHeight);
                            finalWidth = finalHeight * aspectRatio;
                            if (finalWidth > maxWidth) {
                                finalWidth = maxWidth;
                                finalHeight = finalWidth / aspectRatio;
                            }
                        }

                        slide.addImage({
                            data: imageData,
                            x: '55%',
                            y: 1.1, // Align with bullet points
                            w: finalWidth,
                            h: finalHeight,
                            sizing: {
                                type: 'contain',
                                w: finalWidth,
                                h: finalHeight
                            }
                        });

                        // Add caption if it exists
                        const caption = container.querySelector('.image-caption');
                        if (caption) {
                            slide.addText(caption.textContent, {
                                x: '55%',
                                y: 1.1 + finalHeight + 0.2,
                                w: '40%',
                                fontSize: 12,
                                color: '666666',
                                align: 'center'
                            });
                        }

                        usedPptxImages.add(img.src);
                    } catch (error) {
                        console.error('Error adding image to PPTX:', error);
                    }
                }
            }
        }

        // Save PPTX with presentation name
        await pptx.writeFile(`${fileName}.pptx`);

    } catch (error) {
        console.error('Error exporting to PPTX:', error);
        alert('Error exporting to PowerPoint. Please try again.');
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
        isProcessing = false;
    }
}

async function updateSlidesList() {
    const slidesList = document.getElementById('slidesList');
    slidesList.innerHTML = '';

    slides.forEach((slide, index) => {
        const slideItem = document.createElement('div');
        slideItem.className = `slide-item ${index === currentSlide ? 'active' : ''}`;
        slideItem.dataset.index = index;

        const thumbnail = document.createElement('div');
        thumbnail.className = 'slide-thumbnail';
        thumbnail.textContent = `${index + 1}`;

        const title = document.createElement('div');
        title.className = 'slide-title';
        title.textContent = `Slide ${index + 1}`;

        slideItem.appendChild(thumbnail);
        slideItem.appendChild(title);
        slidesList.appendChild(slideItem);
    });
}

// Function to show image dialog (with debugging comments)
function showImageDialog(slideIndex, img, description) {
    console.log("showImageDialog called. slideIndex:", slideIndex, "img:", img, "description:", description); // Debugging log
    currentEditingSlideIndex = slideIndex;
    currentEditingImage = img;

    const dialog = document.getElementById('imageEditDialog');
    const overlay = document.getElementById('overlay');
    const descInput = document.getElementById('imageDescription');

    console.log("dialog:", dialog, "overlay:", overlay, "descInput:", descInput); // Debugging log

    if (dialog && overlay) {
        descInput.value = description || '';
        dialog.style.display = 'block';
        overlay.style.display = 'block';
    } else {
        console.error('imageEditDialog or overlay element not found!');
    }
}

// Function to close image dialog (with debugging comments)
function closeImageDialog() {
    console.log("closeImageDialog called"); // Debugging log
    const dialog = document.getElementById('imageEditDialog');
    const overlay = document.getElementById('overlay');
    console.log("dialog:", dialog, "overlay:", overlay); // Debugging log

    if (dialog && overlay) {
        dialog.style.display = 'none';
        overlay.style.display = 'none';
    } else {
        console.error('imageEditDialog or overlay element not found!');
    }

    currentEditingSlideIndex = -1;
    currentEditingImage = null;
}

// Function to update image description and get new image (Corrected and Improved)
async function updateImageDescription() {
    if (currentEditingSlideIndex === -1 || !currentEditingImage) return;

    const descInput = document.getElementById('imageDescription');
    const newDescription = descInput.value.trim();

    if (!newDescription) {
        alert('Please enter a description for the image');
        return;
    }

    const imgContainer = currentEditingImage.closest('.slide-image');
    const caption = imgContainer ? imgContainer.querySelector('.image-caption') : null;

    try {
        const newImageUrl = await searchImage(newDescription);

        currentEditingImage.src = newImageUrl;
        currentEditingImage.alt = newDescription;
        currentEditingImage.onerror = function() {
            if (this.src !== placeholderImage) this.src = placeholderImage;
        };

        if (caption) {
            caption.textContent = newDescription;
        }

        saveCurrentSlide();
        closeImageDialog();

    } catch (error) {
        console.error('Error updating image:', error);
        alert('Failed to update image. Please try again.');
        currentEditingImage.src = placeholderImage;
        currentEditingImage.onerror = function() {
            if (this.src !== placeholderImage) this.src = placeholderImage;
        };
        //Still close the dialog even on error.
        closeImageDialog();
    }
}
// Function to generate slide preview (No changes)
function generateSlidePreview(slideIndex, slideContent) {
    const previewDiv = document.getElementById('slidePreview');
    previewDiv.innerHTML = slideContent;

    const images = previewDiv.getElementsByTagName('img');
    for (let img of images) {
        img.style.cursor = 'pointer';
        img.onclick = function() {
            showImageDialog(slideIndex, img, img.alt);
        };
    }
}

// Add event listener for overlay click to close dialog and other DOMContentLoaded logic
document.addEventListener('DOMContentLoaded', async () => {
    const isPro = await checkAuthAndProStatus();
    if (isPro) {
        isProUser = true;
        const generateBtn = document.getElementById('generateBtn');
        const topicInput = document.getElementById('topicInput');
        const slideNumInput = document.getElementById('slideNumInput');
        const exportBtn = document.getElementById('exportBtn');
        const exportPptxBtn = document.getElementById('exportPptxBtn');
        const inputOverlay = document.getElementById('inputOverlay');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const overlay = document.getElementById('overlay'); // No need to check, event listener added below


        // Ensure the dialog and overlay exist before setting up listeners.
        if (overlay) {
            overlay.addEventListener('click', closeImageDialog);
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeImageDialog();
        });

        slideshowTitle = document.getElementById('slideshowTitle');

        document.querySelector('button[onclick="location.reload()"]').addEventListener('click', () => {
            if (slideshowTitle) {
                slideshowTitle.textContent = 'New Slideshow';
                window.presentationName = 'presentation';
            }
        });

        generateBtn.addEventListener('click', async () => {
            const topic = topicInput.value.trim();
            const slideCount = parseInt(slideNumInput.value);

            if (!topic) {
                alert('Please enter a topic');
                return;
            }

            if (isNaN(slideCount) || slideCount < 1 || slideCount > 40) {
                alert('Please enter a valid number of slides (1-40)');
                return;
            }

            if (isProcessing) {
                return;
            }

            inputOverlay.style.display = 'none';

            try {
                loadingOverlay.style.display = 'flex';
                await generateSlides(topic, slideCount);
                loadingOverlay.style.display = 'none';
            } catch (error) {
                console.error('Error generating slides:', error);
                alert('Error generating slides. Please try again.');
                loadingOverlay.style.display = 'none';
                inputOverlay.style.display = 'flex';
            }
        });

        const preview = document.getElementById('slidePreview');
        const slidesList = document.getElementById('slidesList');

        if (exportBtn) exportBtn.addEventListener('click', exportSlides);
        if (exportPptxBtn) exportPptxBtn.addEventListener('click', exportToPPTX);

        slidesList.addEventListener('click', (e) => {
            const slideItem = e.target.closest('.slide-item');
            if (slideItem) {
                saveCurrentSlide();
                currentSlide = parseInt(slideItem.dataset.index);
                updateUI();
            }
        });

        preview.addEventListener('input', () => {
            saveCurrentSlide();
            updateSlidesList();
        });

        // Global keyboard navigation (RESTORED original behavior)
        document.addEventListener('keydown', (e) => {
            // Removed the focus check:  if (!preview.contains(document.activeElement)) { return; }

            if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !isProcessing) {
                e.preventDefault();

                const newSlide = e.key === 'ArrowLeft'
                    ? Math.max(0, currentSlide - 1)
                    : Math.min(slides.length - 1, currentSlide + 1);

                if (newSlide !== currentSlide) {
                    isProcessing = true;
                    saveCurrentSlide();
                    currentSlide = newSlide;
                    updateUI().then(() => {
                        updateSlidesList();
                        isProcessing = false;
                        // Removed: preview.focus();  No longer forcing focus
                    }).catch(error => {
                        console.error('Error during navigation:', error);
                        isProcessing = false;
                    });
                }
            }
        });

      // Ensure the slide preview is focusable for keyboard navigation
        preview.tabIndex = 0;
        document.getElementById('slidePreview').style = `
            width: 100%;
            height: 100%;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 600px;
        `;
    }
});