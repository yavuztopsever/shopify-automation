
Skip to main content

ai.google.dev uses cookies from Google to deliver and enhance the quality of its services and to analyze traffic. Learn more.
Google AI for Developers

/
Community
Cookbook
Get API key
Sign in
Gemini API docs
API Reference

A new native audio model is available for the Live API. Learn more

    Home
    Gemini API
    Gemini API docs

Was this helpful?
Image generation with Gemini (aka Nano Banana)

Gemini can generate and process images conversationally. You can prompt Gemini with text, images, or a combination of both allowing you to create, edit, and iterate on visuals with unprecedented control:

    Text-to-Image: Generate high-quality images from simple or complex text descriptions.
    Image + Text-to-Image (Editing): Provide an image and use text prompts to add, remove, or modify elements, change the style, or adjust the color grading.
    Multi-Image to Image (Composition & Style Transfer): Use multiple input images to compose a new scene or transfer the style from one image to another.
    Iterative Refinement: Engage in a conversation to progressively refine your image over multiple turns, making small adjustments until it's perfect.
    High-Fidelity Text Rendering: Accurately generate images that contain legible and well-placed text, ideal for logos, diagrams, and posters.

All generated images include a SynthID watermark.
Image generation (text-to-image)

The following code demonstrates how to generate an image based on a descriptive prompt.
Python
JavaScript
Go
REST

from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO

client = genai.Client()

prompt = (
    "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme"
)

response = client.models.generate_content(
    model="gemini-2.5-flash-image-preview",
    contents=[prompt],
)

for part in response.candidates[0].content.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = Image.open(BytesIO(part.inline_data.data))
        image.save("generated_image.png")

AI-generated image of a nano banana dish
AI-generated image of a nano banana dish in a Gemini-themed restaurant
Image editing (text-and-image-to-image)

Reminder: Make sure you have the necessary rights to any images you upload. Don't generate content that infringe on others' rights, including videos or images that deceive, harass, or harm. Your use of this generative AI service is subject to our Prohibited Use Policy.

The following example demonstrates uploading base64 encoded images. For multiple images, larger payloads, and supported MIME types, check the Image understanding page.
Python
JavaScript
Go
REST

from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO

client = genai.Client()

prompt = (
    "Create a picture of my cat eating a nano-banana in a "
    "fancy restaurant under the Gemini constellation",
)

image = Image.open("/path/to/cat_image.png")

response = client.models.generate_content(
    model="gemini-2.5-flash-image-preview",
    contents=[prompt, image],
)

for part in response.candidates[0].content.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = Image.open(BytesIO(part.inline_data.data))
        image.save("generated_image.png")

AI-generated image of a cat eating anano banana
AI-generated image of a cat eating a nano banana
Other image generation modes

Gemini supports other image interaction modes based on prompt structure and context, including:

    Text to image(s) and text (interleaved): Outputs images with related text.
        Example prompt: "Generate an illustrated recipe for a paella."
    Image(s) and text to image(s) and text (interleaved): Uses input images and text to create new related images and text.
        Example prompt: (With an image of a furnished room) "What other color sofas would work in my space? can you update the image?"
    Multi-turn image editing (chat): Keep generating and editing images conversationally.
        Example prompts: [upload an image of a blue car.] , "Turn this car into a convertible.", "Now change the color to yellow."

Prompting guide and strategies

Mastering Gemini 2.5 Flash Image Generation starts with one fundamental principle:

    Describe the scene, don't just list keywords. The model's core strength is its deep language understanding. A narrative, descriptive paragraph will almost always produce a better, more coherent image than a list of disconnected words.

Prompts for generating images

The following strategies will help you create effective prompts to generate exactly the images you're looking for.
1. Photorealistic scenes

For realistic images, use photography terms. Mention camera angles, lens types, lighting, and fine details to guide the model toward a photorealistic result.
Template
Prompt
Python
JavaScript
Go
REST

A photorealistic [shot type] of [subject], [action or expression], set in
[environment]. The scene is illuminated by [lighting description], creating
a [mood] atmosphere. Captured with a [camera/lens details], emphasizing
[key textures and details]. The image should be in a [aspect ratio] format.

A photorealistic close-up portrait of an elderly Japanese ceramicist...
A photorealistic close-up portrait of an elderly Japanese ceramicist...
2. Stylized illustrations & stickers

To create stickers, icons, or assets, be explicit about the style and request a transparent background.
Template
Prompt
Python
JavaScript
Go
REST

A [style] sticker of a [subject], featuring [key characteristics] and a
[color palette]. The design should have [line style] and [shading style].
The background must be transparent.

A kawaii-style sticker of a happy red...
A kawaii-style sticker of a happy red panda...
3. Accurate text in images

Gemini excels at rendering text. Be clear about the text, the font style (descriptively), and the overall design.
Template
Prompt
Python
JavaScript
Go
REST

Create a [image type] for [brand/concept] with the text "[text to render]"
in a [font style]. The design should be [style description], with a
[color scheme].

Create a modern, minimalist logo for a coffee shop called 'The Daily Grind'...
Create a modern, minimalist logo for a coffee shop called 'The Daily Grind'...
4. Product mockups & commercial photography

Perfect for creating clean, professional product shots for e-commerce, advertising, or branding.
Template
Prompt
Python
JavaScript
Go
REST

A high-resolution, studio-lit product photograph of a [product description]
on a [background surface/description]. The lighting is a [lighting setup,
e.g., three-point softbox setup] to [lighting purpose]. The camera angle is
a [angle type] to showcase [specific feature]. Ultra-realistic, with sharp
focus on [key detail]. [Aspect ratio].

A high-resolution, studio-lit product photograph of a minimalist ceramic coffee mug...
A high-resolution, studio-lit product photograph of a minimalist ceramic coffee mug...
5. Minimalist & negative space design

Excellent for creating backgrounds for websites, presentations, or marketing materials where text will be overlaid.
Template
Prompt
Python
JavaScript
Go
REST

A minimalist composition featuring a single [subject] positioned in the
[bottom-right/top-left/etc.] of the frame. The background is a vast, empty
[color] canvas, creating significant negative space. Soft, subtle lighting.
[Aspect ratio].

A minimalist composition featuring a single, delicate red maple leaf...
A minimalist composition featuring a single, delicate red maple leaf...
6. Sequential art (Comic panel / Storyboard)

Builds on character consistency and scene description to create panels for visual storytelling.
Template
Prompt
Python
JavaScript
Go
REST

A single comic book panel in a [art style] style. In the foreground,
[character description and action]. In the background, [setting details].
The panel has a [dialogue/caption box] with the text "[Text]". The lighting
creates a [mood] mood. [Aspect ratio].

A single comic book panel in a gritty, noir art style...
A single comic book panel in a gritty, noir art style...
Prompts for editing images

These examples show how to provide images alongside your text prompts for editing, composition, and style transfer.
1. Adding and removing elements

Provide an image and describe your change. The model will match the original image's style, lighting, and perspective.
Template
Prompt
Python
JavaScript
Go
REST

Using the provided image of [subject], please [add/remove/modify] [element]
to/from the scene. Ensure the change is [description of how the change should
integrate].

Input
	

Output
A photorealistic picture of a fluffy ginger cat..
A photorealistic picture of a fluffy ginger cat...
	
Using the provided image of my cat, please add a small, knitted wizard hat...
Using the provided image of my cat, please add a small, knitted wizard hat...
2. Inpainting (Semantic masking)

Conversationally define a "mask" to edit a specific part of an image while leaving the rest untouched.
Template
Prompt
Python
JavaScript
Go
REST

Using the provided image, change only the [specific element] to [new
element/description]. Keep everything else in the image exactly the same,
preserving the original style, lighting, and composition.

Input
	

Output
A wide shot of a modern, well-lit living room...
A wide shot of a modern, well-lit living room...
	
Using the provided image of a living room, change only the blue sofa to be a vintage, brown leather chesterfield sofa...
Using the provided image of a living room, change only the blue sofa to be a vintage, brown leather chesterfield sofa...
3. Style transfer

Provide an image and ask the model to recreate its content in a different artistic style.
Template
Prompt
Python
JavaScript
Go
REST

Transform the provided photograph of [subject] into the artistic style of [artist/art style]. Preserve the original composition but render it with [description of stylistic elements].

Input
	

Output
A photorealistic, high-resolution photograph of a busy city street...
A photorealistic, high-resolution photograph of a busy city street...
	
Transform the provided photograph of a modern city street at night...
Transform the provided photograph of a modern city street at night...
4. Advanced composition: Combining multiple images

Provide multiple images as context to create a new, composite scene. This is perfect for product mockups or creative collages.
Template
Prompt
Python
JavaScript
Go
REST

Create a new image by combining the elements from the provided images. Take
the [element from image 1] and place it with/on the [element from image 2].
The final image should be a [description of the final scene].

Input 1
	

Input 2
	

Output
A professionally shot photo of a blue floral summer dress...
A professionally shot photo of a blue floral summer dress...
	
Full-body shot of a woman with her hair in a bun...
Full-body shot of a woman with her hair in a bun...
	
Create a professional e-commerce fashion photo...
Create a professional e-commerce fashion photo...
5. High-fidelity detail preservation

To ensure critical details (like a face or logo) are preserved during an edit, describe them in great detail along with your edit request.
Template
Prompt
Python
JavaScript
Go
REST

Using the provided images, place [element from image 2] onto [element from
image 1]. Ensure that the features of [element from image 1] remain
completely unchanged. The added element should [description of how the
element should integrate].

Input 1
	

Input 2
	

Output
A professional headshot of a woman with brown hair and blue eyes...
A professional headshot of a woman with brown hair and blue eyes...
	
A simple, modern logo with the letters 'G' and 'A'...
A simple, modern logo with the letters 'G' and 'A'...
	
Take the first image of the woman with brown hair, blue eyes, and a neutral expression...
Take the first image of the woman with brown hair, blue eyes, and a neutral expression...
Best Practices

To elevate your results from good to great, incorporate these professional strategies into your workflow.

    Be Hyper-Specific: The more detail you provide, the more control you have. Instead of "fantasy armor," describe it: "ornate elven plate armor, etched with silver leaf patterns, with a high collar and pauldrons shaped like falcon wings."
    Provide Context and Intent: Explain the purpose of the image. The model's understanding of context will influence the final output. For example, "Create a logo for a high-end, minimalist skincare brand" will yield better results than just "Create a logo."
    Iterate and Refine: Don't expect a perfect image on the first try. Use the conversational nature of the model to make small changes. Follow up with prompts like, "That's great, but can you make the lighting a bit warmer?" or "Keep everything the same, but change the character's expression to be more serious."
    Use Step-by-Step Instructions: For complex scenes with many elements, break your prompt into steps. "First, create a background of a serene, misty forest at dawn. Then, in the foreground, add a moss-covered ancient stone altar. Finally, place a single, glowing sword on top of the altar."
    Use "Semantic Negative Prompts": Instead of saying "no cars," describe the desired scene positively: "an empty, deserted street with no signs of traffic."
    Control the Camera: Use photographic and cinematic language to control the composition. Terms like wide-angle shot, macro shot, low-angle perspective.

Limitations

    For best performance, use the following languages: EN, es-MX, ja-JP, zh-CN, hi-IN.
    Image generation does not support audio or video inputs.
    The model won't always follow the exact number of image outputs that the user explicitly asked for.
    The model works best with up to 3 images as an input.
    When generating text for an image, Gemini works best if you first generate the text and then ask for an image with the text.
    Uploading images of children is not currently supported in EEA, CH, and UK.
    All generated images include a SynthID watermark.

When to use Imagen

In addition to using Gemini's built-in image generation capabilities, you can also access Imagen, our specialized image generation model, through the Gemini API.
Attribute 	Imagen 	Gemini Native Image
Strengths 	Most capable image generation model to date. Recommended for photorealistic images, sharper clarity, improved spelling and typography. 	Default recommendation.
Unparalleled flexibility, contextual understanding, and simple, mask-free editing. Uniquely capable of multi-turn conversational editing.
Availability 	Generally available 	Preview (Production usage allowed)
Latency 	Low. Optimized for near-real-time performance. 	Higher. More computation is required for its advanced capabilities.
Cost 	Cost-effective for specialized tasks. $0.02/image to $0.12/image 	Token-based pricing. $30 per 1 million tokens for image output (image output tokenized at 1290 tokens per image flat, up to 1024x1024px)
Recommended tasks 	

    Image quality, photorealism, artistic detail, or specific styles (e.g., impressionism, anime) are top priorities.
    Infusing branding, style, or generating logos and product designs.
    Generating advanced spelling or typography.

	

    Interleaved text and image generation to seamlessly blend text and images.
    Combine creative elements from multiple images with a single prompt.
    Make highly specific edits to images, modify individual elements with simple language commands, and iteratively work on an image.
    Apply a specific design or texture from one image to another while preserving the original subject's form and details.

Imagen 4 should be your go-to model starting to generate images with Imagen. Choose Imagen 4 Ultra for advanced use-cases or when you need the best image quality (note that can only generate one image at a time).
What's next
