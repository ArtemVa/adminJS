import mongoose from "mongoose";
const Schema = mongoose.Schema;


const softDeletePlugin = (schema) => {
  schema.add({
    deletedAt: { type: Date, default: null },
    restored_at: { type: Date, default: null },
  });

  schema.pre(/^find/, function (next) {
    if (!this.getQuery().hasOwnProperty("deletedAt")) {
      this.where({ deletedAt: null });
    }
    next();
  });

  schema.methods.softDelete = function () {
    this.deletedAt = new Date();
    this.restored_at = null;
    return this.save();
  };

  schema.methods.restore = function () {
    this.deletedAt = null;
    this.restored_at = new Date();
    return this.save();
  };
};

const projectFileSchema = new Schema({
  project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  file: { type: String, required: true, maxlength: 1000 },
  file_url: { type: String, required: true, maxlength: 1000, default: "" },
  file_data: { type: Buffer },
  file_text: { type: String, default: "" },
  updated_at: { type: Date, default: Date.now },
  created_at: { type: Date, default: Date.now }
});

projectFileSchema.pre("save", async function (next) {
    if ((this.file_text && this.file_text.length > 0) || this.file_data) {
      return next();
    }
  
    try {
      if (!this.file_url) {
        throw new Error("File URL is required");
      }
      const ext = path.extname(this.file_url).toLowerCase();
      const fileStorage = await FileStorage.findOne({ file_path: this.file_url });
      if (!fileStorage) {
        throw new Error("File not found in FileStorage");
      }
      const fileContent = fileStorage.file_data;
      this.file_data = fileContent;
  
      if (ext === ".txt") {
        this.file_text = fileContent.toString("utf-8").trim();
      } else if (ext === ".pdf") {
        const result = await pdfParse(fileContent);
        this.file_text = result.text.trim();
      } else if (ext === ".docx") {
        const result = await mammoth.extractRawText({ buffer: fileContent });
        this.file_text = result.value.trim();
      } else {
        throw new Error(`Unsupported file format: ${ext}`);
      }
    } catch (error) {
      return next(new Error(`Error processing file: ${error.message}`));
    }
    next();
  });

projectFileSchema.post("save", async function () {
  try {
    const files = await mongoose.model("ProjectFile").find({
      project: this.project,
      deletedAt: null
    });

    const combinedText = files
      .map(f => f.file_text?.trim())
      .filter(Boolean)
      .join('\n\n');

    await Project.findByIdAndUpdate(this.project, {
      knowledge_base_text: combinedText
    });
  } catch (err) {
    console.error("Error updating project knowledge_base_text:", err);
  }
});

projectFileSchema.plugin(softDeletePlugin);

const ProjectFile = mongoose.model("ProjectFile", projectFileSchema);
export default ProjectFile;
