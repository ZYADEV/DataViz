// @ts-ignore
import jsPDF from 'jspdf';

export const exportAIAnalysisReport = async (
  analysisContent: string, 
  datasetName: string
): Promise<void> => {
  const pdf = new jsPDF('p', 'pt', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 50;
  const contentWidth = pageWidth - (margin * 2);
  
  // Title page
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.text('AI Data Analysis Report', pageWidth / 2, 100, { align: 'center' });
  
  pdf.setFontSize(18);
  pdf.text(datasetName, pageWidth / 2, 140, { align: 'center' });
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, 180, { align: 'center' });
  pdf.text(`Powered by AI Analysis`, pageWidth / 2, 200, { align: 'center' });
  
  // Add decorative line
  pdf.setLineWidth(2);
  pdf.line(margin, 220, pageWidth - margin, 220);
  
  pdf.addPage();
  
  // Process the markdown content
  let currentY = margin + 20;
  const lineHeight = 16;
  const lines = analysisContent.split('\n');
  
  for (const line of lines) {
    // Check if we need a new page
    if (currentY > pageHeight - margin - 30) {
      pdf.addPage();
      currentY = margin + 20;
    }
    
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('# ')) {
      // Main heading
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      const text = trimmedLine.substring(2);
      pdf.text(text, margin, currentY);
      currentY += 30;
    } else if (trimmedLine.startsWith('## ')) {
      // Sub heading
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      const text = trimmedLine.substring(3);
      pdf.text(text, margin, currentY);
      currentY += 24;
    } else if (trimmedLine.startsWith('### ')) {
      // Sub-sub heading
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      const text = trimmedLine.substring(4);
      pdf.text(text, margin, currentY);
      currentY += 20;
    } else if (trimmedLine.startsWith('- ')) {
      // Bullet point
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      const text = '• ' + trimmedLine.substring(2);
      const wrappedText = pdf.splitTextToSize(text, contentWidth - 20);
      pdf.text(wrappedText, margin + 15, currentY);
      currentY += wrappedText.length * lineHeight;
    } else if (trimmedLine.length > 0) {
      // Regular paragraph
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      const wrappedText = pdf.splitTextToSize(trimmedLine, contentWidth);
      pdf.text(wrappedText, margin, currentY);
      currentY += wrappedText.length * lineHeight;
    } else {
      // Empty line
      currentY += 10;
    }
  }
  
  // Add footer with page numbers
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 20, { align: 'center' });
  }
  
  pdf.save(`AI_Analysis_${datasetName.replace(/\s+/g, '_')}.pdf`);
};


